"""Authorized MCP tool execution node."""

from __future__ import annotations

import json
import logging
import re
import time
from typing import Any, Dict

from core_ai.contracts.chat import Citation, FallbackInfo, RouteStatus
from core_ai.contracts.mcp import ToolRequest, ToolResult
from core_ai.dependencies import get_component
from core_ai.graph.state import GraphState, add_execution_trace
from core_ai.observability.metrics import record_fallback

logger = logging.getLogger("core_ai.graph.nodes.tool_node")


def determine_tool_for_query(message: str, user_id: Any = None) -> tuple[str, Dict[str, Any]]:
    """Choose a tool deterministically; authenticated identity never comes from query text."""
    lowered = message.lower()
    if any(word in lowered for word in ("học phí", "công nợ", "đóng học")):
        return "check_tuition", {"student_id": str(user_id or "")}
    if any(word in lowered for word in ("lịch thi", "thời khóa biểu", "lịch học")):
        return "lookup_schedule", {"student_id": str(user_id or "")}
    if any(word in lowered for word in ("quy chế", "quy định", "tốt nghiệp")):
        return "get_regulations", {"category": "all", "keywords": message}
    # Creating a support case is a side effect and must only be selected by an
    # explicit, approved caller flow, never inferred from free-form text.
    return "search_knowledge", {"query": message}


async def tool_node(state: GraphState) -> GraphState:
    """Execute a scoped tool and convert only successful output into evidence."""
    started = time.perf_counter()
    state["current_stage"] = "tool_execution"
    tool_name = state.get("tool_name_requested")
    tool_args = state.get("tool_args_requested")
    if not tool_name:
        tool_name, defaults = determine_tool_for_query(
            state.get("message", ""), state.get("user_id")
        )
        tool_args = tool_args or defaults

    gateway = get_component("mcp_gateway")
    success = False
    result_data: Any = None
    if gateway is not None:
        try:
            result: ToolResult = await gateway.call_tool(
                ToolRequest(
                    request_id=state.get("request_id", ""),
                    tenant_id=state.get("tenant_id", "vnua"),
                    user_id=state.get("user_id"),
                    tool_name=tool_name,
                    arguments=tool_args or {},
                    timeout_seconds=3.0,
                    approved=state.get("tool_approved", False),
                )
            )
            success = result.success
            result_data = result.data
        except Exception as exc:
            logger.warning(
                "MCP tool failed for request_id=%s tool=%s error=%s",
                state.get("request_id"),
                tool_name,
                type(exc).__name__,
            )
    else:
        logger.warning("MCP Gateway unavailable; no synthetic tool result will be generated")

    state["tool_calls_made"] = state.get("tool_calls_made", 0) + 1
    if success and result_data:
        state.setdefault("tool_results", []).append({"tool_name": tool_name, "data": result_data})
        if tool_name == "create_support_case":
            raw_ticket_id = str(
                result_data.get("ticket_id")
                or result_data.get("case_id")
                or result_data.get("id")
                or ""
            )
            ticket_id = re.sub(r"[^A-Za-z0-9_-]", "", raw_ticket_id)[:64]
            state["status"] = RouteStatus.ESCALATED
            state["answer"] = (
                "Yêu cầu hỗ trợ của bạn đã được chuyển tới cán bộ phụ trách."
                + (f" Mã phiếu: {ticket_id}." if ticket_id else "")
            )
            state["confidence"] = 1.0
            state["fallback"] = FallbackInfo(
                reason="human_escalation",
                original_route="tool_execution",
                fallback_strategy="escalate_hitl",
                ticket_id=ticket_id or None,
            )
            record_fallback("human_escalation", "escalate_hitl")
            state["is_sufficient_evidence"] = False
        else:
            index = len(state.get("retrieved_chunks", [])) + 1
            snippet = json.dumps(result_data, ensure_ascii=False, default=str)[:2000]
            chunk = {
                "citation_id": f"src_{index}",
                "document_id": f"mcp_{tool_name}",
                "title": f"Dữ liệu xác thực từ hệ thống ({tool_name})",
                "page": None,
                "chunk_index": 0,
                "snippet": snippet,
                "relevance_score": 0.95,
            }
            state.setdefault("retrieved_chunks", []).append(chunk)
            state.setdefault("citations", []).append(Citation(**chunk))
            state["is_sufficient_evidence"] = True
    elif tool_name == "create_support_case":
        state["status"] = RouteStatus.DEGRADED
        state["fallback"] = FallbackInfo(
            reason="tool_unavailable",
            original_route="tool_execution",
            fallback_strategy="safe_template",
            contact_channel="Ban Quản lý Đào tạo VNUA: phongdaotao@vnua.edu.vn",
        )

    add_execution_trace(
        state,
        "tool_execution",
        "completed" if success else "failed",
        int((time.perf_counter() - started) * 1000),
        {"tool_name": tool_name, "success": success},
    )
    return state
