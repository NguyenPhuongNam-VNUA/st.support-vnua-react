"""Semantic cache node for LangGraph orchestration.

Performs Redis semantic cache lookups using tenant, ACL, and locale isolation.
If a valid cached entry is found:
- Populates answer and verified citations (0 external AI calls).
- Directly transitions to output guardrail / completion.
If cache miss or Redis degraded:
- Safely continues pipeline to parallel hybrid retrieval.
"""

from __future__ import annotations

import asyncio
import logging
import time
from typing import Any

from core_ai.contracts.chat import Citation, RouteStatus
from core_ai.dependencies import get_component
from core_ai.graph.state import GraphState, add_execution_trace
from core_ai.observability.metrics import record_cache_access, record_cache_level

logger = logging.getLogger("core_ai.graph.nodes.cache_node")


def _apply_cached(state: GraphState, cached_result: Any, level: str) -> None:
    if hasattr(cached_result, "model_dump"):
        cached_result = cached_result.model_dump()
    citations = [
        item if isinstance(item, Citation) else Citation(**item)
        for item in cached_result.get("citations", [])
    ]
    state["cache_hit"] = True
    state["cache_level"] = level
    state["cached_answer"] = cached_result.get("answer", "")
    state["cached_citations"] = citations
    state["cached_confidence"] = cached_result.get("confidence", 0.95)
    state["answer"] = state["cached_answer"] or ""
    state["citations"] = citations
    state["confidence"] = state["cached_confidence"] or 0.95
    state["status"] = RouteStatus.ANSWERED


async def exact_cache_node(state: GraphState) -> GraphState:
    """L1 exact cache; a hit consumes zero external AI calls."""
    t0 = time.perf_counter()
    state["current_stage"] = "exact_cache"
    query = state.get("message", "")
    tenant_id = state.get("tenant_id", "vnua")

    semantic_cache = get_component("semantic_cache")

    if semantic_cache is not None and hasattr(semantic_cache, "get"):
        try:
            cached_result = await semantic_cache.get(
                query=query,
                tenant_id=tenant_id,
                locale=state.get("locale", "vi-VN"),
                user_scope=str(state.get("user_id") or "anonymous"),
            )
            if cached_result is not None:
                latency = int((time.perf_counter() - t0) * 1000)
                _apply_cached(state, cached_result, "exact")
                state["external_calls_count"] = 0
                record_cache_level("exact", True)

                add_execution_trace(
                    state,
                    "semantic_cache",
                    "cached",
                    latency,
                    {"hit": True, "cache_level": "exact"},
                )
                record_cache_access(hit=True, tenant_id=tenant_id)
                logger.info(
                    "Semantic cache HIT for request_id=%s (0 external AI calls consumed)",
                    state.get("request_id"),
                )
                return state
        except Exception as exc:
            # Degraded-safe: Redis failure must NEVER crash the request pipeline
            logger.warning(
                "Redis cache lookup error for request_id=%s: %s; continuing to retrieval",
                state.get("request_id"),
                exc,
            )

    state["cache_hit"] = False
    record_cache_level("exact", False)
    record_cache_access(hit=False, tenant_id=tenant_id)
    add_execution_trace(
        state, "exact_cache", "completed", int((time.perf_counter() - t0) * 1000), {"hit": False}
    )
    return state


async def semantic_cache_node(state: GraphState) -> GraphState:
    """L2 similarity cache using the single reusable query embedding."""
    t0 = time.perf_counter()
    state["current_stage"] = "semantic_cache"
    query = state.get("normalized_query") or state.get("message", "")
    tenant_id = state.get("tenant_id", "vnua")
    semantic_cache = get_component("semantic_cache")
    embedding = state.get("query_embedding", [])
    cached_result: Any = None
    if semantic_cache is not None and embedding and hasattr(semantic_cache, "get_semantic"):
        try:
            cached_result = await semantic_cache.get_semantic(
                query_embedding=embedding,
                tenant_id=tenant_id,
                locale=state.get("locale", "vi-VN"),
                user_scope=str(state.get("user_id") or "anonymous"),
                topic=str(state.get("topic") or "general"),
            )
        except Exception as exc:
            logger.warning("L2 cache unavailable; bypassing safely: %s", type(exc).__name__)
            cached_result = None
        if cached_result is not None:
            _apply_cached(state, cached_result, "semantic")
            record_cache_level("semantic", True)
            record_cache_access(hit=True, tenant_id=tenant_id)
            add_execution_trace(
                state,
                "semantic_cache",
                "cached",
                int((time.perf_counter() - t0) * 1000),
                {"hit": True, "cache_level": "semantic"},
            )
            return state

    # Cache Miss: acquire a short distributed generation lock. A concurrent
    record_cache_level("semantic", False)
    # request gets a brief opportunity to consume the first request's exact result.
    if semantic_cache is not None and hasattr(semantic_cache, "acquire_stampede_lock"):
        token = str(state.get("request_id", ""))
        try:
            acquired = await semantic_cache.acquire_stampede_lock(
                query=query,
                token=token,
                tenant_id=tenant_id,
                locale=state.get("locale", "vi-VN"),
                user_scope=str(state.get("user_id") or "anonymous"),
            )
        except Exception as exc:
            logger.warning("Cache lock unavailable; continuing safely: %s", type(exc).__name__)
            acquired = False
        state["cache_lock_acquired"] = acquired
        state["cache_lock_token"] = token if acquired else None
        if not acquired:
            for _ in range(4):
                await asyncio.sleep(0.1)
                try:
                    cached_result = await semantic_cache.get(
                        query=query,
                        tenant_id=tenant_id,
                        locale=state.get("locale", "vi-VN"),
                        user_scope=str(state.get("user_id") or "anonymous"),
                    )
                except Exception:
                    break
                if cached_result is not None:
                    _apply_cached(state, cached_result, "exact_after_wait")
                    record_cache_access(hit=True, tenant_id=tenant_id)
                    add_execution_trace(
                        state,
                        "semantic_cache",
                        "cached",
                        int((time.perf_counter() - t0) * 1000),
                        {"hit": True, "waited_for_lock": True},
                    )
                    return state

    # Cache Miss or Degraded Fallback
    latency = int((time.perf_counter() - t0) * 1000)
    state["cache_hit"] = False
    record_cache_access(hit=False, tenant_id=tenant_id)
    add_execution_trace(
        state,
        "semantic_cache",
        "completed",
        latency,
        {"hit": False},
    )
    return state


# Backwards-compatible import name.
cache_node = exact_cache_node
