"""Admin retrieval test: runs the same embedding + retrieval nodes as chat, without generation."""

from __future__ import annotations

import time
import uuid
from typing import Any, Dict

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field

from core_ai.dependencies import verify_internal_token
from core_ai.graph.nodes.embedding_node import embedding_node
from core_ai.graph.nodes.query_prep_node import expand_chat_abbreviations
from core_ai.graph.nodes.retrieval_node import retrieval_node

router = APIRouter(tags=["Retrieval"], dependencies=[Depends(verify_internal_token)])


class RetrievalTestRequest(BaseModel):
    query: str = Field(..., min_length=2, max_length=1000)
    top_k: int = Field(default=3, ge=1, le=10)


@router.post("/api/v1/retrieval/test")
async def test_retrieval(body: RetrievalTestRequest, http_request: Request) -> Dict[str, Any]:
    context = getattr(http_request.state, "context", None)
    tenant_id = getattr(context, "tenant_id", None) or "vnua"
    started = time.perf_counter()
    state: Dict[str, Any] = {
        "request_id": getattr(context, "request_id", None) or f"retrieval-test-{uuid.uuid4()}",
        "tenant_id": tenant_id,
        "message": body.query,
        "normalized_query": expand_chat_abbreviations(" ".join(body.query.split())),
        "external_calls_count": 0,
        "max_external_calls": 1,
    }
    state = await embedding_node(state)  # type: ignore[arg-type]
    state = await retrieval_node(state)  # type: ignore[arg-type]

    chunks = state.get("retrieved_chunks", [])[: body.top_k]
    return {
        "query": body.query,
        "normalized_query": state["normalized_query"],
        "embedding_ready": bool(state.get("query_embedding")),
        "rerank_strategy": state.get("rerank_strategy"),
        "degraded": bool(state.get("error_code")),
        "error_code": state.get("error_code"),
        "latency_ms": int((time.perf_counter() - started) * 1000),
        "results": [
            {
                "source_type": c.get("source_type"),
                "document_id": c.get("document_id"),
                "title": c.get("title"),
                "page": c.get("page"),
                "page_end": c.get("page_end"),
                "chunk_index": c.get("chunk_index"),
                "version": c.get("version"),
                "validity_status": c.get("validity_status"),
                "snippet": c.get("snippet"),
                "final_score": c.get("final_score"),
                "dense_similarity": c.get("dense_similarity"),
                "sparse_score": c.get("sparse_score"),
            }
            for c in chunks
        ],
    }
