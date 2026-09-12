"""Conditional edge routing functions for LangGraph orchestration.

Implements deterministic routing rules:
- Safe academic input -> topic validation -> embedding
- FAQ and document candidates -> merged reranking -> generation
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
) -> Literal["query_prep", "tool_node", "fallback"]:
    """Route safe input to normalization, or blocked input to fallback."""
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
    return "query_prep"


def route_after_cache(
    state: GraphState,
) -> Literal["output_guardrail", "embedding"]:
    """Route a cache hit to output verification, otherwise create the embedding."""
    if state.get("cache_hit", False):
        logger.info("Routing after cache_check: CACHE_HIT -> output_guardrail (0 external calls)")
        return "output_guardrail"
    return "embedding"


def route_after_query_prep(
    state: GraphState,
) -> Literal["topic_scoring", "generation", "fallback"]:
    if not state.get("topic_precheck_out", False):
        return "topic_scoring"
    return "generation" if state.get("user_intent") == "social" else "fallback"


def route_after_topic(state: GraphState) -> Literal["cache_check", "fallback"]:
    if not state.get("is_in_domain", False):
        return "fallback"
    return "cache_check"


def route_after_semantic_cache(state: GraphState) -> Literal["output_guardrail", "retrieval"]:
    return "output_guardrail" if state.get("cache_hit", False) else "retrieval"


def route_after_evidence(
    state: GraphState,
) -> Literal["generation", "retrieval", "fallback"]:
    """Generate only from usable FAQ/document evidence; otherwise refuse safely."""
    evidence_band = state.get("evidence_band")
    has_distinctive_match = state.get("has_distinctive_match", True)

    # 1. Strong evidence still needs a meaningful query-term match.
    if state.get("is_sufficient_evidence", False) and has_distinctive_match:
        logger.info(
            "Routing after evidence_eval: SUFFICIENT (score=%.3f) -> generation",
            state.get("evidence_score", 0.0),
        )
        return "generation"

    # 2. Corrective retrieval retry: strictly limited to at most 1 retry and 0 extra LLM calls
    retrieval_attempts = state.get("retrieval_attempts", 0)
    if evidence_band in ("medium", "high") and retrieval_attempts < 2:
        logger.info(
            "Routing after evidence_eval: INSUFFICIENT -> corrective retrieval "
            "retry (attempt %d of 2)",
            retrieval_attempts + 1,
        )
        return "retrieval"

    # 3. Medium evidence remains usable after the single corrective retry.
    if (
        evidence_band in ("medium", "high")
        and has_distinctive_match
        and state.get("retrieved_chunks")
    ):
        logger.info(
            "Routing after evidence_eval: MEDIUM evidence retained after retry -> generation"
        )
        return "generation"

    # 4. Low/empty evidence must never reach the LLM as an academic answer.
    logger.info("Routing after evidence_eval: LOW_OR_EMPTY evidence -> fallback")
    return "fallback"


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
