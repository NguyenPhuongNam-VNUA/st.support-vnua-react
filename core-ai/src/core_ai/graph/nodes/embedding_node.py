"""Create the single reusable query embedding after topic validation."""

from __future__ import annotations

import time

from core_ai.dependencies import get_component
from core_ai.graph.state import GraphState, add_execution_trace


async def embedding_node(state: GraphState) -> GraphState:
    started = time.perf_counter()
    state["current_stage"] = "embedding"
    query = state.get("normalized_query") or state.get("message", "")
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
        "embedding",
        status,  # type: ignore[arg-type]
        int((time.perf_counter() - started) * 1000),
        {"embedding_ready": bool(state["query_embedding"])},
    )
    return state
