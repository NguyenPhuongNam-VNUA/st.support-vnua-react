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
) -> Literal["cache_check", "fallback"]:
    """Routes to semantic cache if input is safe, or directly to fallback if blocked."""
    if state.get("is_blocked", False):
        logger.info("Routing after input_guardrail: BLOCKED -> fallback")
        return "fallback"
    return "cache_check"


def route_after_cache(
    state: GraphState,
) -> Literal["output_guardrail", "retrieval"]:
    """Routes to output guardrail if cache hit (0 external AI calls), or retrieval on miss."""
    if state.get("cache_hit", False):
        logger.info("Routing after cache_check: CACHE_HIT -> output_guardrail (0 external calls)")
        return "output_guardrail"
    return "retrieval"


def route_after_evidence(
    state: GraphState,
) -> Literal["generation", "retrieval", "tool_node", "fallback"]:
    """Routes based on evidence grounding quality, corrective retry budget, and tool availability."""
    # 1. Sufficient evidence -> Answer Generation
    if state.get("is_sufficient_evidence", False):
        logger.info(
            "Routing after evidence_eval: SUFFICIENT (score=%.3f) -> generation",
            state.get("evidence_score", 0.0),
        )
        return "generation"

    # 2. Corrective retrieval retry: strictly limited to at most 1 retry and 0 extra LLM calls
    retrieval_attempts = state.get("retrieval_attempts", 0)
    if retrieval_attempts < 2:
        logger.info(
            "Routing after evidence_eval: INSUFFICIENT -> corrective retrieval retry (attempt %d of 2)",
            retrieval_attempts + 1,
        )
        return "retrieval"

    # 3. If corrective retrieval already exhausted, attempt MCP tool lookup
    tool_calls = state.get("tool_calls_made", 0)
    if tool_calls == 0:
        logger.info("Routing after evidence_eval: INSUFFICIENT -> tool_node (MCP lookup)")
        return "tool_node"

    # 4. Clarify / HITL Fallback if neither retrieval nor tools yield sufficient evidence
    logger.info("Routing after evidence_eval: INSUFFICIENT -> fallback (HITL clarify)")
    return "fallback"


def route_after_tool(
    state: GraphState,
) -> Literal["generation", "fallback"]:
    """Routes to generation if tool provided sufficient context, else fallback."""
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
