"""Evidence evaluation node for LangGraph orchestration.

Computes grounding evidence scores based on retrieved chunk relevance and semantic
density. Determines whether to route directly to Answer Generation or trigger
MCP tool lookup / corrective retrieval / HITL fallback.
"""

from __future__ import annotations

import logging
import re
import time
from typing import List

from core_ai.graph.state import GraphState, add_execution_trace
from core_ai.observability.metrics import record_retrieval_evidence

logger = logging.getLogger("core_ai.graph.nodes.evidence_node")

GENERIC_QUERY_TERMS = {
    "bạn",
    "bao",
    "có",
    "cho",
    "cấp",
    "của",
    "được",
    "học",
    "hỏi",
    "gì",
    "kỳ",
    "mỗi",
    "mình",
    "nào",
    "nhiêu",
    "không",
    "là",
    "như",
    "sinh",
    "sao",
    "tại",
    "thế",
    "thì",
    "trong",
    "viên",
    "vnua",
    "về",
    "đâu",
    "ra",
}


async def evidence_node(state: GraphState) -> GraphState:
    """Evaluates grounding evidence score from retrieved chunks."""
    t0 = time.perf_counter()
    state["current_stage"] = "evidence_eval"

    chunks = state.get("retrieved_chunks", [])
    from core_ai.config import get_settings

    settings = get_settings()
    low_threshold = settings.evidence_low_threshold
    high_threshold = settings.evidence_high_threshold

    if not chunks:
        evidence_score = 0.0
        signals = {
            "relevance": 0.0,
            "coverage": 0.0,
            "distinctive_matches": 0,
            "distinctive_terms": 0,
            "freshness": 0.0,
            "source_trust": 0.0,
            "conflict": 1.0,
        }
        is_sufficient = False
        has_distinctive_match = False
    else:
        # Calculate weighted average score of top snippets
        top_scores: List[float] = []
        for chunk in chunks[:3]:
            score = chunk.get("relevance_score")
            if score is not None and isinstance(score, (int, float)):
                top_scores.append(float(score))
            else:
                top_scores.append(0.0)

        relevance = sum(top_scores) / len(top_scores) if top_scores else 0.0

        # Adjust score based on snippet content length and keyword presence
        all_query_words = {
            word for word in state.get("query_terms", []) if len(word) > 1
        }
        query_words = all_query_words - GENERIC_QUERY_TERMS or all_query_words
        matched_words = 0
        total_snippet_text = " ".join(c.get("snippet", "") for c in chunks).lower()
        snippet_words = set(re.findall(r"[\w]+", total_snippet_text, flags=re.UNICODE))
        for word in query_words:
            if word in snippet_words:
                matched_words += 1

        coverage = matched_words / max(1, len(query_words))
        required_matches = min(2, len(query_words))
        has_distinctive_match = (
            bool(query_words)
            and matched_words >= required_matches
            and coverage >= 0.5
        )
        freshness_values = [float(chunk.get("freshness_score", 0.70)) for chunk in chunks[:3]]
        trust_values = [float(chunk.get("source_trust", 0.80)) for chunk in chunks[:3]]
        freshness = sum(freshness_values) / len(freshness_values)
        source_trust = sum(trust_values) / len(trust_values)

        # Conservative local conflict signal: multiple distinct money/date values across
        # top evidence reduce confidence and force corrective retrieval/HITL.
        factual_values: set[str] = set()
        for chunk in chunks[:3]:
            snippet = str(chunk.get("snippet", "")).lower()
            factual_values.update(re.findall(r"\b\d[\d.,/\-]{2,}\b", snippet))
        conflict = min(1.0, max(0.0, (len(factual_values) - 3) / 5.0))
        evidence_score = (
            0.35 * relevance
            + 0.25 * coverage
            + 0.15 * freshness
            + 0.15 * source_trust
            + 0.10 * (1.0 - conflict)
        )
        signals = {
            "relevance": round(relevance, 4),
            "coverage": round(coverage, 4),
            "distinctive_matches": matched_words,
            "distinctive_terms": len(query_words),
            "freshness": round(freshness, 4),
            "source_trust": round(source_trust, 4),
            "conflict": round(conflict, 4),
        }
        is_sufficient = evidence_score >= high_threshold

    state["evidence_score"] = round(evidence_score, 4)
    state["is_sufficient_evidence"] = is_sufficient
    state["has_distinctive_match"] = has_distinctive_match
    state["evidence_band"] = (
        "high"
        if evidence_score >= high_threshold
        else "medium"
        if evidence_score >= low_threshold
        else "low"
    )
    state["confidence"] = state["evidence_score"]
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
            "band": state["evidence_band"],
            "low_threshold": low_threshold,
            "high_threshold": high_threshold,
            **signals,
        },
    )
    logger.info(
        "Evidence evaluated for request_id=%s: score=%.3f, sufficient=%s",
        state.get("request_id"),
        evidence_score,
        is_sufficient,
    )
    return state
