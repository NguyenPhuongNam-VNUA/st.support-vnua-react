"""Tenant-safe hybrid retrieval node with one sparse corrective retry."""

from __future__ import annotations

import asyncio
import logging
import re
import time
from typing import Any, List

from core_ai.contracts.chat import Citation
from core_ai.config import get_settings
from core_ai.dependencies import get_component
from core_ai.graph.state import GraphState, add_execution_trace
from core_ai.retrieval.bm25 import RankedChunk
from core_ai.retrieval.rrf import reciprocal_rank_fusion

logger = logging.getLogger("core_ai.graph.nodes.retrieval_node")

VIETNAMESE_STOP_PATTERNS = [
    re.compile(r"\b(cho\s+em\s+hỏi|thầy\s+cô\s+cho\s+em\s+hỏi|ad\s+cho\s+em\s+hỏi)\b", re.I),
    re.compile(r"\b(làm\s+ơn\s+cho\s+em\s+biết|em\s+muốn\s+hỏi\s+về|xin\s+hỏi\s+về)\b", re.I),
    re.compile(r"\b(dạ|ạ|cho\s+mình\s+hỏi|cho\s+em\s+xin)\b", re.I),
]


def reformulate_query_deterministic(original_query: str) -> str:
    refined = original_query
    for pattern in VIETNAMESE_STOP_PATTERNS:
        refined = pattern.sub(" ", refined)
    refined = re.sub(r"[^\w\s\d\-_/]", " ", refined)
    refined = re.sub(r"\s+", " ", refined).strip()
    return refined if len(refined) >= 3 else original_query


def _uses_external_embedding(retriever: Any) -> bool:
    vector_retriever = getattr(retriever, "vector_retriever", None)
    embedding_service = getattr(vector_retriever, "embedding_service", None)
    return bool(getattr(embedding_service, "is_external", False))


def _to_evidence(chunk: RankedChunk, index: int) -> tuple[dict[str, Any], Citation]:
    score = chunk.rerank_score
    if score is None:
        score = chunk.similarity if chunk.similarity is not None else chunk.rrf_score
    score = max(0.0, min(1.0, float(score or 0.0)))
    evidence = {
        "citation_id": f"src_{index}",
        "document_id": chunk.document_id,
        "title": chunk.document_title,
        "page": chunk.page,
        "chunk_index": chunk.chunk_index,
        "snippet": chunk.content[:2000],
        "relevance_score": score,
    }
    return evidence, Citation(**evidence)


async def retrieval_node(state: GraphState) -> GraphState:
    """Run dense+sparse initially, then a sparse-only corrective retry.

    The retry deliberately skips Gemini query embedding so the final external
    call remains available for grounded answer generation.
    """
    started = time.perf_counter()
    state["current_stage"] = "retrieval"
    attempts = state.get("retrieval_attempts", 0) + 1
    state["retrieval_attempts"] = attempts
    query = (
        reformulate_query_deterministic(state.get("message", ""))
        if attempts > 1
        else state.get("message", "")
    )
    tenant_id = state.get("tenant_id", "vnua")
    retriever = get_component("hybrid_retriever")

    candidates: List[RankedChunk] = []
    retrieval_status = "completed"
    include_dense = attempts == 1
    if retriever is None:
        retrieval_status = "degraded"
        state["error_code"] = "retrieval_unavailable"
        logger.warning("Hybrid retriever unavailable for request_id=%s", state.get("request_id"))
    else:
        if include_dense and _uses_external_embedding(retriever):
            if state.get("external_calls_count", 0) >= state.get("max_external_calls", 2):
                include_dense = False
            else:
                state["external_calls_count"] = state.get("external_calls_count", 0) + 1
        try:
            dense, sparse = await retriever.retrieve_parallel(
                query=query,
                top_k=10,
                tenant_id=tenant_id,
                include_dense=include_dense,
            )
            candidates = reciprocal_rank_fusion(dense, sparse, top_k=10)
            reranker = get_component("local_reranker")
            final_top_k = get_settings().retrieval_top_k
            if reranker is not None:
                try:
                    reranked = await asyncio.wait_for(
                        asyncio.to_thread(
                            reranker.rerank,
                            query,
                            candidates,
                            target_top_n=final_top_k,
                        ),
                        timeout=get_settings().reranker_timeout_seconds,
                    )
                    candidates = reranked.snippets
                    state["rerank_strategy"] = getattr(reranked, "strategy", "unknown")
                except asyncio.TimeoutError:
                    logger.warning("BGE reranker timed out; using RRF order")
                    state["rerank_strategy"] = "rrf_timeout_fallback"
                    candidates = candidates[:final_top_k]
                except Exception as exc:
                    logger.warning(
                        "Local reranker unavailable for request_id=%s: %s; using RRF order",
                        state.get("request_id"),
                        type(exc).__name__,
                    )
                    state["rerank_strategy"] = "rrf_error_fallback"
                    candidates = candidates[:final_top_k]
            else:
                state["rerank_strategy"] = "rrf_unavailable_fallback"
                candidates = candidates[:final_top_k]
        except Exception as exc:
            retrieval_status = "degraded"
            state["error_code"] = "retrieval_failed"
            logger.warning(
                "Tenant-safe retrieval failed for request_id=%s: %s",
                state.get("request_id"),
                type(exc).__name__,
            )

    pairs = [_to_evidence(chunk, index) for index, chunk in enumerate(candidates, 1)]
    state["retrieved_chunks"] = [pair[0] for pair in pairs]
    state["citations"] = [pair[1] for pair in pairs]
    add_execution_trace(
        state,
        "retrieval",
        retrieval_status,  # type: ignore[arg-type]
        int((time.perf_counter() - started) * 1000),
        {
            "snippets_count": len(candidates),
            "attempt": attempts,
            "dense_enabled": include_dense,
            "rerank_strategy": state.get("rerank_strategy", "none"),
        },
    )
    return state
