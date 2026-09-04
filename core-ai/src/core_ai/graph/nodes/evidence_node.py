"""Evidence evaluation node for LangGraph orchestration.

Computes grounding evidence scores based on retrieved chunk relevance and semantic
density. Determines whether to route directly to Answer Generation or trigger
MCP tool lookup / corrective retrieval / HITL fallback.
"""

from __future__ import annotations

import logging
import time
from typing import Any, Dict, List

from core_ai.graph.state import GraphState, add_execution_trace
from core_ai.observability.metrics import record_retrieval_evidence

logger = logging.getLogger("core_ai.graph.nodes.evidence_node")


async def evidence_node(state: GraphState) -> GraphState:
    """Evaluates grounding evidence score from retrieved chunks."""
    t0 = time.perf_counter()
    state["current_stage"] = "evidence_eval"

    chunks = state.get("retrieved_chunks", [])
    threshold = state.get("evidence_threshold", 0.60)

    if not chunks:
        evidence_score = 0.0
        is_sufficient = False
    else:
        # Calculate weighted average score of top snippets
        top_scores: List[float] = []
        for chunk in chunks[:3]:
            score = chunk.get("relevance_score")
            if score is not None and isinstance(score, (int, float)):
                top_scores.append(float(score))
            else:
                top_scores.append(0.0)

        evidence_score = sum(top_scores) / len(top_scores) if top_scores else 0.0

        # Adjust score based on snippet content length and keyword presence
        query_words = set(state.get("message", "").lower().split())
        matched_words = 0
        total_snippet_text = " ".join(c.get("snippet", "") for c in chunks).lower()
        for word in query_words:
            if len(word) > 2 and word in total_snippet_text:
                matched_words += 1

        keyword_ratio = matched_words / max(1, len(query_words))
        # Blend relevance score with keyword coverage
        evidence_score = 0.7 * evidence_score + 0.3 * keyword_ratio
        is_sufficient = evidence_score >= threshold

    state["evidence_score"] = round(evidence_score, 4)
    state["is_sufficient_evidence"] = is_sufficient
    record_retrieval_evidence(is_sufficient, state.get("tenant_id", "vnua"))

    latency = int((time.perf_counter() - t0) * 1000)
    add_execution_trace(
        state,
        "evidence_eval",
        "completed",
        latency,
        {
            "evidence_score": state["evidence_score"],
            "sufficient": is_sufficient,
            "threshold": threshold,
        },
    )
    logger.info(
        "Evidence evaluated for request_id=%s: score=%.3f, sufficient=%s",
        state.get("request_id"),
        evidence_score,
        is_sufficient,
    )
    return state
