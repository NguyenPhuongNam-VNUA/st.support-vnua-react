"""Prepare one reusable query embedding and local sparse terms."""

from __future__ import annotations

import re
import time

from core_ai.dependencies import get_component
from core_ai.graph.state import GraphState, add_execution_trace

_OBVIOUS_OUT_OF_DOMAIN = re.compile(
    r"\b(?:dự báo thời tiết|nấu món|bóng đá|chứng khoán|tiền điện tử|viết code|"
    r"lập trình|xem phim|tử vi)\b",
    re.IGNORECASE,
)


async def query_prep_node(state: GraphState) -> GraphState:
    started = time.perf_counter()
    state["current_stage"] = "query_prep"
    query = " ".join(state.get("message", "").split())
    state["normalized_query"] = query
    state["query_terms"] = [
        term for term in re.findall(r"[\w]+", query.lower(), flags=re.UNICODE) if len(term) > 1
    ]
    # A narrow deterministic pre-gate avoids paying for an embedding on clearly
    # unrelated requests. Unknown queries still continue to semantic anchors so
    # legitimate student wording is not rejected merely for missing keywords.
    if _OBVIOUS_OUT_OF_DOMAIN.search(query):
        state["topic_precheck_out"] = True
        state["is_in_domain"] = False
        add_execution_trace(
            state,
            "query_prep",
            "completed",
            int((time.perf_counter() - started) * 1000),
            {
                "embedding_ready": False,
                "terms_count": len(state["query_terms"]),
                "route": "out_of_domain",
            },
        )
        return state
    status = "completed"
    embedding_service = get_component("embedding_service")
    if embedding_service is not None and state.get("external_calls_count", 0) < state.get(
        "max_external_calls", 2
    ):
        state["external_calls_count"] = state.get("external_calls_count", 0) + 1
        try:
            state["query_embedding"] = await embedding_service.embed_query(query)
        except Exception:
            state["query_embedding"] = []
            status = "degraded"
            state["error_code"] = "query_embedding_unavailable"
    else:
        state["query_embedding"] = []
        status = "degraded"
    add_execution_trace(
        state,
        "query_prep",
        status,  # type: ignore[arg-type]
        int((time.perf_counter() - started) * 1000),
        {
            "embedding_ready": bool(state["query_embedding"]),
            "terms_count": len(state["query_terms"]),
        },
    )
    return state
