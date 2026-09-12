"""Tenant-safe parallel FAQ and document retrieval with merged reranking."""

from __future__ import annotations

import asyncio
import logging
import re
import time
import unicodedata
from datetime import date, datetime
from typing import Any, List

from core_ai.config import get_settings
from core_ai.contracts.chat import Citation
from core_ai.data.repositories.question_repo import QuestionRecord
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

# Student-service intents that are often combined in one question. Matching is
# deterministic so retrieval does not spend an extra LLM call on query routing.
QUERY_FACETS = (
    "hoc phi",
    "hoc bong",
    "dang ky hoc phan",
    "tin chi",
    "bao luu",
    "ky tuc xa",
    "tot nghiep",
    "phuc khao",
)
def reformulate_query_deterministic(original_query: str) -> str:
    refined = original_query
    for pattern in VIETNAMESE_STOP_PATTERNS:
        refined = pattern.sub(" ", refined)
    refined = re.sub(r"[^\w\s\d\-_/]", " ", refined)
    refined = re.sub(r"\s+", " ", refined).strip()
    return refined if len(refined) >= 3 else original_query


def _iso(value: Any) -> str | None:
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    return str(value) if value not in (None, "") else None


def _query_date(query: str) -> date:
    full_date = re.search(r"\b(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b", query)
    if full_date:
        try:
            return date(int(full_date.group(3)), int(full_date.group(2)), int(full_date.group(1)))
        except ValueError:
            pass
    year = re.search(r"\b(20\d{2})\b", query)
    return date(int(year.group(1)), 7, 1) if year else date.today()


def _date_value(value: Any) -> date | None:
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    if isinstance(value, str):
        try:
            return date.fromisoformat(value[:10])
        except ValueError:
            return None
    return None


def _normalize_for_match(value: str) -> str:
    normalized = unicodedata.normalize("NFD", value.casefold())
    without_accents = "".join(character for character in normalized if not unicodedata.combining(character))
    return re.sub(r"[^a-z0-9]+", " ", without_accents).strip()


def _select_with_facet_coverage(
    candidates: List[RankedChunk], top_k: int, query: str
) -> List[RankedChunk]:
    """Preserve ranking while covering explicit multi-part student questions."""
    if top_k <= 0:
        return []
    query_text = _normalize_for_match(query)
    facets = [facet for facet in QUERY_FACETS if facet in query_text]
    if len(facets) < 2:
        return candidates[:top_k]

    selected: List[RankedChunk] = []
    selected_ids: set[str] = set()
    for facet in facets:
        match = next(
            (
                candidate
                for candidate in candidates
                if candidate.chunk_id not in selected_ids
                and facet
                in _normalize_for_match(candidate.content)
            ),
            None,
        )
        if match is not None:
            selected.append(match)
            selected_ids.add(match.chunk_id)
            reasons = match.source_metadata.setdefault("selection_reason", [])
            reason = f"facet_match:{facet.replace(' ', '_')}"
            if reason not in reasons:
                reasons.append(reason)
        if len(selected) >= top_k:
            return selected

    selected.extend(
        candidate
        for candidate in candidates
        if candidate.chunk_id not in selected_ids
    )
    return selected[:top_k]


def _rank_deterministically(
    candidates: List[RankedChunk], as_of: date, query: str
) -> List[RankedChunk]:
    query_terms = set(_normalize_for_match(query).split())
    for chunk in candidates:
        if chunk.source_type == "faq":
            if chunk.rerank_score is not None:
                score = chunk.rerank_score
                reason = "bge_cross_encoder"
            else:
                content_terms = set(_normalize_for_match(chunk.content).split())
                lexical_score = len(query_terms & content_terms) / max(1, len(query_terms))
                score = 0.8 * float(chunk.similarity or 0.0) + 0.2 * lexical_score
                reason = "deterministic_semantic_lexical_rerank"
            chunk.final_score = max(0.0, min(1.0, float(score or 0.0)))
            chunk.source_metadata["selection_reason"] = ["approved_faq", reason]
            continue

        metadata = chunk.source_metadata
        valid_from = _date_value(metadata.get("effective_from"))
        valid_to = _date_value(metadata.get("effective_to"))
        validity_status = str(metadata.get("validity_status") or "unknown")
        in_date_range = (valid_from is None or valid_from <= as_of) and (
            valid_to is None or as_of <= valid_to
        )
        if validity_status in {"revoked", "superseded"}:
            validity_score = 0.0
        elif validity_status == "expired" or not in_date_range:
            validity_score = 0.15
        elif validity_status == "effective":
            validity_score = 1.0
        else:
            validity_score = 0.7

        if chunk.rerank_score is not None:
            dense_score = float(chunk.rerank_score)
            reasons = ["bge_cross_encoder"]
        else:
            dense_score = float(chunk.similarity if chunk.similarity is not None else chunk.rrf_score or 0.0)
            reasons = ["semantic_match" if chunk.similarity is not None else "rank_fusion"]
        raw_sparse = max(0.0, float(chunk.fts_score or 0.0))
        sparse_score = raw_sparse / (1.0 + raw_sparse)
        source_trust = max(0.0, min(1.0, float(metadata.get("source_trust") or 0.8)))
        score = 0.55 * dense_score + 0.25 * sparse_score + 0.15 * validity_score + 0.05 * source_trust
        if metadata.get("contains_ocr") and float(metadata.get("ocr_confidence_min") or 1.0) < 0.9:
            score *= 0.9
        chunk.final_score = round(max(0.0, min(1.0, score)), 6)
        if chunk.fts_score is not None:
            reasons.append("keyword_match")
        reasons.append("document_effective" if validity_score == 1.0 else "validity_checked")
        metadata["selection_reason"] = reasons
        metadata["normalized_sparse_score"] = round(sparse_score, 6)
        metadata["validity_score"] = validity_score

    return sorted(candidates, key=lambda item: item.final_score or 0.0, reverse=True)


def _faq_to_ranked(question: QuestionRecord, rank: int) -> RankedChunk:
    return RankedChunk(
        chunk_id=f"faq:{question.id}",
        document_id=f"faq:{question.id}",
        chunk_index=question.id,
        document_title=f"FAQ đã duyệt{f' - {question.topic}' if question.topic else ''}",
        content=f"Câu hỏi đã duyệt: {question.question}\nTrả lời: {question.answer or ''}",
        similarity=question.similarity,
        rank=rank,
        retrieval_source="faq",
        source_type="faq",
        source_metadata={
            **question.metadata,
            "faq_id": question.id,
            "source_document_id": question.source_document_id,
            "article": question.source_article,
            "clause": question.source_clause,
            "effective_from": question.valid_from,
            "effective_to": question.valid_to,
            "verified_at": question.verified_at,
            "validity_status": "effective",
            "source_trust": 1.0,
        },
    )


def _to_evidence(
    chunk: RankedChunk, index: int
) -> tuple[dict[str, Any], Citation | None]:
    score = chunk.final_score
    if score is None:
        score = chunk.similarity if chunk.similarity is not None else chunk.rrf_score
    score = max(0.0, min(1.0, float(score or 0.0)))
    metadata = chunk.source_metadata
    page_end = metadata.get("page_end") or chunk.page
    sparse_score = metadata.get("normalized_sparse_score")
    selection_reason = list(metadata.get("selection_reason") or [])
    validity_status = metadata.get("validity_status")
    freshness_score = (
        1.0 if validity_status == "effective" else 0.3 if validity_status in {"expired", "revoked", "superseded"} else 0.7
    )
    is_document = chunk.source_type == "document"
    evidence_id = f"src_{index}" if is_document else f"faq_{chunk.chunk_index}"
    evidence = {
        "citation_id": evidence_id,
        "document_id": chunk.document_id,
        "title": chunk.document_title,
        "page": chunk.page,
        "chunk_index": chunk.chunk_index,
        "snippet": chunk.content[:2000],
        "relevance_score": score,
        "source_type": chunk.source_type,
        "page_end": page_end,
        "document_number": metadata.get("document_number") if is_document else None,
        "version": metadata.get("version") if is_document else None,
        "issued_date": _iso(metadata.get("issued_date")) if is_document else None,
        "effective_from": _iso(metadata.get("effective_from")) if is_document else None,
        "effective_to": _iso(metadata.get("effective_to")) if is_document else None,
        "validity_status": validity_status if is_document else None,
        "article": metadata.get("article") if is_document else None,
        "clause": metadata.get("clause") if is_document else None,
        "point": metadata.get("point") if is_document else None,
        "dense_similarity": chunk.similarity,
        "sparse_score": sparse_score,
        "fusion_score": chunk.rrf_score,
        "final_score": score,
        "selection_reason": selection_reason,
        "source_trust": max(0.0, min(1.0, float(metadata.get("source_trust") or 0.8))),
        "freshness_score": freshness_score,
    }
    if not is_document:
        return evidence, None

    citation = Citation(
        citation_id=f"src_{index}",
        document_id=chunk.document_id,
        title=chunk.document_title,
        page=chunk.page,
        chunk_index=chunk.chunk_index,
        snippet=chunk.content[:2000],
        relevance_score=score,
        source_type=chunk.source_type,
        page_end=page_end,
        document_number=metadata.get("document_number"),
        document_type=metadata.get("document_type"),
        version=metadata.get("version"),
        issuer=metadata.get("issuer"),
        issued_date=_iso(metadata.get("issued_date")),
        effective_from=_iso(metadata.get("effective_from")),
        effective_to=_iso(metadata.get("effective_to")),
        validity_status=metadata.get("validity_status"),
        article=metadata.get("article"),
        clause=metadata.get("clause"),
        point=metadata.get("point"),
        dense_similarity=chunk.similarity,
        sparse_score=sparse_score,
        fusion_score=chunk.rrf_score,
        final_score=score,
        selection_reason=selection_reason,
    )
    return evidence, citation


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
    include_dense = attempts == 1 and bool(state.get("query_embedding"))
    if retriever is None:
        retrieval_status = "degraded"
        state["error_code"] = "retrieval_unavailable"
        logger.warning("Hybrid retriever unavailable for request_id=%s", state.get("request_id"))
    else:
        try:
            retrieval_task = retriever.retrieve_parallel(
                query=query,
                query_embedding=state.get("query_embedding") or None,
                top_k=10,
                tenant_id=tenant_id,
                include_dense=include_dense,
            )
            faq_task = None
            vector_retriever = getattr(retriever, "vector_retriever", None)
            if include_dense and vector_retriever is not None and hasattr(vector_retriever, "search_faq"):
                faq_task = vector_retriever.search_faq(
                    query=query,
                    query_embedding=state.get("query_embedding") or None,
                    top_k=10,
                    min_similarity=0.65,
                    tenant_id=tenant_id,
                )

            if faq_task is not None:
                retrieval_outcome, faq_outcome = await asyncio.gather(
                    retrieval_task, faq_task, return_exceptions=True
                )
                if isinstance(retrieval_outcome, BaseException) and isinstance(
                    faq_outcome, BaseException
                ):
                    raise retrieval_outcome
                if isinstance(retrieval_outcome, BaseException):
                    logger.warning(
                        "Document retrieval degraded for request_id=%s: %s",
                        state.get("request_id"),
                        type(retrieval_outcome).__name__,
                    )
                    dense, sparse = [], []
                else:
                    dense, sparse = retrieval_outcome
                if isinstance(faq_outcome, BaseException):
                    logger.warning(
                        "FAQ retrieval degraded for request_id=%s: %s",
                        state.get("request_id"),
                        type(faq_outcome).__name__,
                    )
                    faq_results: List[QuestionRecord] = []
                else:
                    faq_results = faq_outcome
            else:
                dense, sparse = await retrieval_task
                faq_results = []

            candidates = reciprocal_rank_fusion(dense, sparse, top_k=10)
            candidates.extend(
                _faq_to_ranked(question, rank)
                for rank, question in enumerate(faq_results, start=1)
            )
            state["retrieval_route"] = "faq_and_document"
            final_top_k = get_settings().retrieval_top_k

            # Rerank bằng BGE Cross-Encoder model nếu có sẵn
            reranker = get_component("local_reranker")
            if reranker is not None and getattr(reranker, "available", False) is True:
                try:
                    reranked = await asyncio.wait_for(
                        asyncio.to_thread(
                            reranker.rerank,
                            query,
                            candidates,
                            target_top_n=len(candidates),
                        ),
                        timeout=get_settings().reranker_timeout_seconds,
                    )
                    candidates = reranked.snippets
                    state["rerank_strategy"] = getattr(reranked, "strategy", "bge_cross_encoder")
                except asyncio.TimeoutError:
                    logger.warning("BGE reranker timed out; using deterministic fallback")
                    state["rerank_strategy"] = "rrf_timeout_fallback"
                except Exception as exc:
                    logger.warning(
                        "Local reranker failed for request_id=%s: %s; using deterministic fallback",
                        state.get("request_id"),
                        type(exc).__name__,
                    )
                    state["rerank_strategy"] = "rrf_error_fallback"
            else:
                state["rerank_strategy"] = "deterministic_rrf_weighted"

            ranked_candidates = _rank_deterministically(candidates, _query_date(query), query)
            candidates = _select_with_facet_coverage(ranked_candidates, final_top_k, query)
        except Exception as exc:
            retrieval_status = "degraded"
            state["error_code"] = "retrieval_failed"
            logger.warning(
                "Tenant-safe retrieval failed for request_id=%s: %s",
                state.get("request_id"),
                type(exc).__name__,
            )

    evidence: List[dict[str, Any]] = []
    citations: List[Citation] = []
    document_index = 0
    for chunk in candidates:
        if chunk.source_type == "document":
            document_index += 1
        item, citation = _to_evidence(chunk, document_index)
        evidence.append(item)
        if citation is not None:
            citations.append(citation)
    state["retrieved_chunks"] = evidence
    state["citations"] = citations
    add_execution_trace(
        state,
        "retrieval",
        retrieval_status,  # type: ignore[arg-type]
        int((time.perf_counter() - started) * 1000),
        {
            "snippets_count": len(candidates),
            "attempt": attempts,
            "dense_enabled": include_dense,
            "faq_count": sum(chunk.source_type == "faq" for chunk in candidates),
            "rerank_strategy": state.get("rerank_strategy", "none"),
            "retrieval_route": state.get("retrieval_route", "none"),
        },
    )
    return state
