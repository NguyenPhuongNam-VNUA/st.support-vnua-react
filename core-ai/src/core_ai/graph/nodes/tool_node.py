"""Authorized MCP tool execution node."""

from __future__ import annotations

import json
import logging
import time
from typing import Any, Dict

from core_ai.contracts.chat import Citation
from core_ai.contracts.mcp import ToolRequest, ToolResult
from core_ai.dependencies import get_component
from core_ai.graph.state import GraphState, add_execution_trace

logger = logging.getLogger("core_ai.graph.nodes.tool_node")


def determine_tool_for_query(message: str, user_id: Any = None) -> tuple[str, Dict[str, Any]]:
    """Choose a tool deterministically; authenticated identity never comes from query text."""
    lowered = message.lower()
    if any(word in lowered for word in ("quy chế", "quy định", "tốt nghiệp")):
        return "get_regulations", {"category": "all", "keywords": message}
    return "search_knowledge", {"query": message}


async def tool_node(state: GraphState) -> GraphState:
    """Execute a scoped tool and convert only successful output into evidence."""
    started = time.perf_counter()
    state["current_stage"] = "tool_execution"
    tool_name, tool_args = determine_tool_for_query(
        state.get("message", ""), state.get("user_id")
    )

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

    add_execution_trace(
        state,
        "tool_execution",
        "completed" if success else "failed",
        int((time.perf_counter() - started) * 1000),
        {"tool_name": tool_name, "success": success},
    )
    return state
