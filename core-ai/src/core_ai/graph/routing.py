"""Conditional edge routing functions for LangGraph orchestration.

Implements deterministic routing rules adhering to Section 10 of
CORE_AI_IMPLEMENTATION_PLAN.md:
- Cache hit -> output_guardrail (0 external AI calls)
- Cache miss -> retrieval -> evidence_eval
- Evidence evaluation -> generation (if sufficient)
  or corrective retrieval (max 1 retry, 0 extra LLM calls)
  or tool_node (MCP lookup)
  or fallback (HITL clarify / degrade)
"""

from __future__ import annotations

import logging
from typing import Literal

from core_ai.contracts.chat import RouteStatus
from core_ai.graph.state import GraphState

logger = logging.getLogger("core_ai.graph.routing")


def route_after_input_guardrail(
    state: GraphState,
) -> Literal["cache_check", "tool_node", "fallback"]:
    """Routes to semantic cache if input is safe, or directly to fallback if blocked."""
    if state.get("is_blocked", False):
        logger.info("Routing after input_guardrail: BLOCKED -> fallback")
        return "fallback"
    if state.get("redaction_required", False):
        return "fallback"
    if state.get("tool_name_requested") == "create_support_case" and state.get(
        "tool_approved", False
    ):
        logger.info("Routing explicitly approved support request to MCP tool")
        return "tool_node"
    return "cache_check"


def route_after_cache(
    state: GraphState,
) -> Literal["output_guardrail", "query_prep"]:
    """Routes to output guardrail if cache hit (0 external AI calls), or retrieval on miss."""
    if state.get("cache_hit", False):
        logger.info("Routing after cache_check: CACHE_HIT -> output_guardrail (0 external calls)")
        return "output_guardrail"
    return "query_prep"


def route_after_query_prep(state: GraphState) -> Literal["topic_scoring", "generation"]:
    return "generation" if state.get("topic_precheck_out", False) else "topic_scoring"


def route_after_topic(state: GraphState) -> Literal["semantic_cache", "generation"]:
    if not state.get("is_in_domain", False):
        return "generation"
    return "semantic_cache"


def route_after_semantic_cache(state: GraphState) -> Literal["output_guardrail", "retrieval"]:
    return "output_guardrail" if state.get("cache_hit", False) else "retrieval"


def route_after_evidence(
    state: GraphState,
) -> Literal["generation", "retrieval", "tool_node", "fallback"]:
    """Route by evidence quality, corrective retry budget, and tool availability."""
    # 1. Sufficient evidence -> Answer Generation
    if state.get("is_sufficient_evidence", False):
        logger.info(
            "Routing after evidence_eval: SUFFICIENT (score=%.3f) -> generation",
            state.get("evidence_score", 0.0),
        )
        return "generation"

    # 2. Corrective retrieval retry: strictly limited to at most 1 retry and 0 extra LLM calls
    retrieval_attempts = state.get("retrieval_attempts", 0)
    if state.get("evidence_band") == "medium" and retrieval_attempts < 2:
        logger.info(
            "Routing after evidence_eval: INSUFFICIENT -> corrective retrieval "
            "retry (attempt %d of 2)",
            retrieval_attempts + 1,
        )
        return "retrieval"

    # 3. If corrective retrieval already exhausted, attempt MCP tool lookup
    tool_calls = state.get("tool_calls_made", 0)
    structured_tool_terms = (
        "học phí",
        "công nợ",
        "đóng học",
        "lịch thi",
        "thời khóa biểu",
        "lịch học",
        "quy chế",
        "quy định",
        "tốt nghiệp",
        "hỗ trợ",
        "khiếu nại",
    )
    needs_structured_tool = any(
        term in state.get("message", "").lower() for term in structured_tool_terms
    )
    if tool_calls == 0 and needs_structured_tool:
        logger.info("Routing after evidence_eval: INSUFFICIENT -> tool_node (MCP lookup)")
        return "tool_node"

    # 4. Route to generation for dynamic, helpful AI synthesis and friendly guidance
    logger.info("Routing after evidence_eval: INSUFFICIENT -> generation (dynamic AI response)")
    return "generation"


def route_after_tool(
    state: GraphState,
) -> Literal["generation", "output_guardrail", "fallback"]:
    """Routes to generation if tool provided sufficient context, else fallback."""
    if state.get("status") == RouteStatus.ESCALATED:
        return "output_guardrail"
    if state.get("is_sufficient_evidence", False):
        logger.info("Routing after tool_node: TOOL_SUCCESS -> generation")
        return "generation"
    logger.info("Routing after tool_node: TOOL_FAILED_OR_INSUFFICIENT -> fallback")
    return "fallback"


def route_after_generation(
    state: GraphState,
) -> Literal["output_guardrail", "fallback"]:
    """Routes to output guardrail on generation success, or fallback on budget exceed/error."""
    if state.get("status") == RouteStatus.DEGRADED or not state.get("answer"):
        logger.info("Routing after generation: DEGRADED -> fallback")
        return "fallback"
    return "output_guardrail"


def route_after_fallback(state: GraphState) -> Literal["output_guardrail"]:
    """Routes fallback answer through output guardrail for sanitization."""
    return "output_guardrail"
