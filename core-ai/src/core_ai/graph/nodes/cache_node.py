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
from typing import Any, Dict, List, Optional

from core_ai.contracts.chat import Citation, RouteStatus
from core_ai.dependencies import get_component
from core_ai.graph.state import GraphState, add_execution_trace
from core_ai.observability.metrics import record_cache_access

logger = logging.getLogger("core_ai.graph.nodes.cache_node")


async def cache_node(state: GraphState) -> GraphState:
    """Checks semantic cache for existing verified answer and citations."""
    t0 = time.perf_counter()
    state["current_stage"] = "semantic_cache"
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
                if hasattr(cached_result, "model_dump"):
                    cached_result = cached_result.model_dump()
                cached_answer = cached_result.get("answer", "")
                cached_citations_raw = cached_result.get("citations", [])
                cached_citations: List[Citation] = []

                for item in cached_citations_raw:
                    if isinstance(item, Citation):
                        cached_citations.append(item)
                    elif isinstance(item, dict):
                        cached_citations.append(Citation(**item))

                state["cache_hit"] = True
                state["cached_answer"] = cached_answer
                state["cached_citations"] = cached_citations
                state["cached_confidence"] = cached_result.get("confidence", 0.95)
                state["answer"] = cached_answer
                state["citations"] = cached_citations
                state["confidence"] = state["cached_confidence"]
                state["status"] = RouteStatus.ANSWERED
                # Strictly enforce 0 external AI calls on cache hit
                state["external_calls_count"] = 0

                add_execution_trace(
                    state,
                    "semantic_cache",
                    "cached",
                    latency,
                    {"hit": True, "source": "redis_semantic_cache"},
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
                "Redis semantic cache lookup error for request_id=%s: %s (falling back to retrieval)",
                state.get("request_id"),
                exc,
            )

    # Cache Miss: acquire a short distributed generation lock. A concurrent
    # request gets a brief opportunity to consume the first request's result.
    if semantic_cache is not None and hasattr(semantic_cache, "acquire_stampede_lock"):
        token = str(state.get("request_id", ""))
        acquired = await semantic_cache.acquire_stampede_lock(
            query=query,
            token=token,
            tenant_id=tenant_id,
            locale=state.get("locale", "vi-VN"),
            user_scope=str(state.get("user_id") or "anonymous"),
        )
        state["cache_lock_acquired"] = acquired
        state["cache_lock_token"] = token if acquired else None
        if not acquired:
            for _ in range(20):
                await asyncio.sleep(0.25)
                cached_result = await semantic_cache.get(
                    query=query,
                    tenant_id=tenant_id,
                    locale=state.get("locale", "vi-VN"),
                    user_scope=str(state.get("user_id") or "anonymous"),
                )
                if cached_result is not None:
                    cached = cached_result.model_dump()
                    state["cache_hit"] = True
                    state["answer"] = cached["answer"]
                    state["citations"] = cached["citations"]
                    state["confidence"] = cached["confidence"]
                    state["external_calls_count"] = 0
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
