"""Deterministic topic, slot, clarity, and context scoring."""

from __future__ import annotations

import time

from core_ai.config import get_settings
from core_ai.contracts.chat import FallbackInfo, RouteStatus
from core_ai.graph.state import GraphState, add_execution_trace
from core_ai.observability.metrics import record_topic_route
from core_ai.retrieval.topic_anchors import TOPICS, TopicAnchorStore

_ANCHORS = TopicAnchorStore()


async def topic_scoring_node(state: GraphState) -> GraphState:
    started = time.perf_counter()
    state["current_stage"] = "topic_scoring"
    query = state.get("normalized_query") or state.get("message", "")
    topic, topic_score, slot_coverage = _ANCHORS.score(query, state.get("query_embedding", []))
    meaningful_terms = [term for term in state.get("query_terms", []) if len(term) > 2]
    clarity = min(1.0, len(meaningful_terms) / 6.0)
    context_fit = 1.0 if state.get("history") else (0.65 if topic else 0.0)
    score = 0.45 * topic_score + 0.25 * slot_coverage + 0.15 * clarity + 0.15 * context_fit
    settings = get_settings()
    is_in_domain = bool(topic and score >= settings.topic_in_domain_threshold)
    should_clarify = bool(
        is_in_domain
        and score < settings.topic_clarify_threshold
        and slot_coverage == 0.0
        and topic in TOPICS
    )
    state.update(
        {
            "topic": topic,
            "topic_score": round(score, 4),
            "slot_coverage": slot_coverage,
            "clarity_score": round(clarity, 4),
            "context_fit": round(context_fit, 4),
            "is_in_domain": is_in_domain,
        }
    )
    if not is_in_domain:
        state["status"] = RouteStatus.REDIRECTED
        state["fallback"] = FallbackInfo(
            reason="out_of_domain",
            original_route="topic_scoring",
            fallback_strategy="safe_redirect",
        )
    elif should_clarify:
        assert topic is not None
        question = str(TOPICS[topic]["clarification"])
        state["clarification_question"] = question
        state["status"] = RouteStatus.CLARIFIED
        state["fallback"] = FallbackInfo(
            reason="clarification_required",
            original_route="topic_scoring",
            fallback_strategy="clarify_prompt",
        )
    record_topic_route(
        topic or "out_of_domain",
        "clarify" if should_clarify else ("in_domain" if is_in_domain else "redirect"),
    )
    add_execution_trace(
        state,
        "topic_scoring",
        "completed",
        int((time.perf_counter() - started) * 1000),
        {
            "topic": topic or "out_of_domain",
            "score": round(score, 3),
            "slot_coverage": slot_coverage,
            "route": "clarify" if should_clarify else ("in_domain" if is_in_domain else "redirect"),
        },
    )
    return state
