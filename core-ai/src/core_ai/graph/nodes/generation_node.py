"""Answer Generation node with strict Call Budget enforcement for LangGraph.

Invokes LLMPort (default Gemini 3.5 Flash) with strict grounding on retrieved
evidence snippets and MCP tool outputs.
Strictly enforces the hard Call Budget ceiling. A normal RAG request spends one
call on Gemini Embedding 2 and one on answer generation; cache hits spend zero.
"""

from __future__ import annotations

import logging
import time
from typing import Any, Dict, List, Optional

from core_ai.contracts.chat import FallbackInfo, RouteStatus
from core_ai.contracts.llm import ChatMessage, GenerationRequest, GenerationResult, LLMPort
from core_ai.dependencies import get_component
from core_ai.graph.state import GraphState, add_execution_trace

logger = logging.getLogger("core_ai.graph.nodes.generation_node")

SYSTEM_PROMPT_TEMPLATE = """Bạn là ST-Care, trợ lý sinh viên VNUA thân thiện, điềm tĩnh và có duyên.
Quy tắc:
1. Trả lời thẳng vào câu hỏi, ngắn gọn, dễ hiểu; thường không quá 5 câu hoặc 5 gạch đầu dòng.
2. Dùng Markdown vừa đủ. Không lặp lại câu hỏi và không dùng lời mở đầu dài.
3. Chỉ dùng dữ liệu trong [TRÍCH DẪN TÀI LIỆU]. Không suy đoán hay bịa thông tin.
4. Đặt [src_X] ngay sau thông tin tương ứng. Không tự tạo mã nguồn trích dẫn.
5. Nếu nguồn chưa đủ, nói rõ điều còn thiếu và đề xuất bước tiếp theo hoặc hỗ trợ từ cán bộ.
6. Giữ cá tính ấm áp, thực tế; một câu dí dỏm nhẹ chỉ khi phù hợp, không làm loãng câu trả lời.
"""


def build_evidence_context(chunks: List[Dict[str, Any]]) -> str:
    """Formats retrieved chunks and tool outputs into structured prompt context."""
    if not chunks:
        return "Không có trích dẫn tài liệu cụ thể."
    lines: List[str] = []
    for chunk in chunks:
        c_id = chunk.get("citation_id", "src_?")
        title = chunk.get("title", "Tài liệu đào tạo")
        snippet = chunk.get("snippet", "").strip()
        lines.append(f"[{c_id}] Tiêu đề: {title}\nNội dung: {snippet}")
    return "\n\n".join(lines)


async def generation_node(state: GraphState) -> GraphState:
    """Executes grounded answer generation adhering to the max-2 external call budget."""
    t0 = time.perf_counter()
    state["current_stage"] = "generation"

    current_calls = state.get("external_calls_count", 0)
    max_calls = state.get("max_external_calls", 2)

    # Hard ceiling: Never exceed 2 external AI calls per request
    if current_calls >= max_calls:
        latency = int((time.perf_counter() - t0) * 1000)
        logger.warning(
            "Call budget ceiling exceeded for request_id=%s (calls: %d >= max: %d)",
            state.get("request_id"),
            current_calls,
            max_calls,
        )
        state["status"] = RouteStatus.DEGRADED
        state["fallback"] = FallbackInfo(
            reason="budget_exceeded",
            original_route="generation",
            fallback_strategy="safe_template",
            contact_channel="Ban Quản lý Đào tạo VNUA: phongdaotao@vnua.edu.vn",
        )
        add_execution_trace(
            state,
            "generation",
            "failed",
            latency,
            {"reason": "call_budget_ceiling_reached", "calls_made": current_calls},
        )
        return state

    # Build Grounded Prompt
    context_text = build_evidence_context(state.get("retrieved_chunks", []))
    user_prompt = (
        f"Câu hỏi của sinh viên: {state.get('message', '')}\n\n"
        f"[TRÍCH DẪN TÀI LIỆU]:\n{context_text}\n\n"
        "Hãy tổng hợp câu trả lời dựa trên trích dẫn trên và đánh dấu [src_X]:"
    )

    llm_port = get_component("llm_port")
    answer_text = ""
    model_name = "gemini-3.5-flash"
    provider = "gemini"
    p_tokens = 0
    c_tokens = 0

    if llm_port is not None and hasattr(llm_port, "generate"):
        gen_request = GenerationRequest(
            request_id=state.get("request_id", ""),
            messages=[
                ChatMessage(role="system", content=SYSTEM_PROMPT_TEMPLATE),
                ChatMessage(role="user", content=user_prompt),
            ],
            temperature=0.2,
            max_tokens=512,
            external_calls_already_made=current_calls,
        )

        try:
            gen_result: GenerationResult = await llm_port.generate(gen_request)
            state["external_calls_count"] = min(
                max_calls, current_calls + gen_result.external_calls_used
            )
            answer_text = gen_result.content
            model_name = gen_result.model_name
            provider = gen_result.provider
            if gen_result.usage:
                p_tokens = gen_result.usage.prompt_tokens
                c_tokens = gen_result.usage.completion_tokens
        except Exception as exc:
            state["external_calls_count"] = min(max_calls, current_calls + 1)
            logger.error(
                "LLM Generation call failed for request_id=%s: %s",
                state.get("request_id"),
                exc,
                exc_info=True,
            )
            state["status"] = RouteStatus.DEGRADED
            state["fallback"] = FallbackInfo(
                reason="provider_unavailable",
                original_route="generation",
                fallback_strategy="safe_template",
                contact_channel="Ban Quản lý Đào tạo VNUA: phongdaotao@vnua.edu.vn",
            )
            latency = int((time.perf_counter() - t0) * 1000)
            add_execution_trace(
                state,
                "generation",
                "failed",
                latency,
                {"error_type": type(exc).__name__},
            )
            return state
    else:
        state["status"] = RouteStatus.DEGRADED
        state["fallback"] = FallbackInfo(
            reason="llm_gateway_unavailable",
            original_route="generation",
            fallback_strategy="safe_template",
            contact_channel="Ban Quản lý Đào tạo VNUA: phongdaotao@vnua.edu.vn",
        )
        add_execution_trace(
            state,
            "generation",
            "failed",
            int((time.perf_counter() - t0) * 1000),
            {"reason": "llm_gateway_unavailable"},
        )
        return state

    state["answer"] = answer_text
    state["confidence"] = 0.92
    state["model_used"] = model_name
    state["provider_used"] = provider
    state["prompt_tokens"] = p_tokens
    state["completion_tokens"] = c_tokens
    state["total_tokens"] = p_tokens + c_tokens
    state["status"] = RouteStatus.ANSWERED

    latency = int((time.perf_counter() - t0) * 1000)
    add_execution_trace(
        state,
        "generation",
        "completed",
        latency,
        {
            "model": model_name,
            "provider": provider,
            "total_tokens": p_tokens + c_tokens,
            "external_calls": state["external_calls_count"],
        },
    )
    return state
