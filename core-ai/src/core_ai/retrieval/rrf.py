"""Reciprocal Rank Fusion (RRF) algorithm for merging hybrid search rankings.

Combines dense (pgvector) and sparse (BM25) rankings using:
    RRF_score(d) = sum( weight_m / (k + rank_m(d)) )
Applies candidate deduplication, source capping per document for diversity,
and ranking normalization.
"""

import logging
from collections import defaultdict
from typing import Dict, List

from core_ai.retrieval.bm25 import RankedChunk

logger = logging.getLogger("core_ai.retrieval.rrf")


def reciprocal_rank_fusion(
    dense_candidates: List[RankedChunk],
    sparse_candidates: List[RankedChunk],
    k: int = 60,
    dense_weight: float = 1.0,
    sparse_weight: float = 1.0,
    max_chunks_per_document: int = 3,
    top_k: int = 10,
) -> List[RankedChunk]:
    """Merge and rank candidates from dense vector search and sparse BM25 search.

    Args:
        dense_candidates: Chunks retrieved by pgvector cosine search, sorted by rank.
        sparse_candidates: Chunks retrieved by BM25 full-text search, sorted by rank.
        k: Smoothing constant to prevent top-ranked outliers from dominating (default 60).
        dense_weight: Multiplier for dense rank scores (default 1.0).
        sparse_weight: Multiplier for sparse rank scores (default 1.0).
        max_chunks_per_document: Cap to enforce document source diversity.
        top_k: Maximum number of merged candidates to return.

    Returns:
        List of deduplicated, source-capped RankedChunk objects sorted by descending rrf_score.
    """
    # Key: chunk_id -> dict with accumulated rrf score and best chunk metadata
    rrf_scores: Dict[int, float] = defaultdict(float)
    merged_chunks: Dict[int, RankedChunk] = {}
    sources_seen: Dict[int, set[str]] = defaultdict(set)

    # 1. Process dense candidates
    for chunk in dense_candidates:
        cid = chunk.chunk_id
        rank = chunk.rank  # 1-based
        score = dense_weight / (k + rank)
        rrf_scores[cid] += score
        sources_seen[cid].add("dense")

        if cid not in merged_chunks:
            merged_chunks[cid] = chunk.model_copy(deep=True)
        else:
            # Update similarity if higher
            existing = merged_chunks[cid]
            if chunk.similarity is not None:
                if existing.similarity is None or chunk.similarity > existing.similarity:
                    existing.similarity = chunk.similarity

    # 2. Process sparse candidates
    for chunk in sparse_candidates:
        cid = chunk.chunk_id
        rank = chunk.rank  # 1-based
        score = sparse_weight / (k + rank)
        rrf_scores[cid] += score
        sources_seen[cid].add("sparse")

        if cid not in merged_chunks:
            merged_chunks[cid] = chunk.model_copy(deep=True)
        else:
            existing = merged_chunks[cid]
            if chunk.fts_score is not None:
                if existing.fts_score is None or chunk.fts_score > existing.fts_score:
                    existing.fts_score = chunk.fts_score

    if not merged_chunks:
        return []

    # 3. Maximum possible theoretical RRF score for normalization
    max_theoretical_rrf = (dense_weight / (k + 1)) + (sparse_weight / (k + 1))

    # 4. Attach RRF scores and update retrieval source tag
    scored_candidates: List[RankedChunk] = []
    for cid, chunk in merged_chunks.items():
        score = rrf_scores[cid]
        # Attach normalized rrf score
        chunk.rrf_score = round(score / max_theoretical_rrf, 6)

        srcs = sources_seen[cid]
        if "dense" in srcs and "sparse" in srcs:
            chunk.retrieval_source = "hybrid"
        elif "dense" in srcs:
            chunk.retrieval_source = "dense"
        else:
            chunk.retrieval_source = "sparse"

        scored_candidates.append(chunk)

    # 5. Sort candidates by descending RRF score
    scored_candidates.sort(key=lambda x: (x.rrf_score or 0.0), reverse=True)

    # 6. Apply source cap per document (to ensure diversity across different regulations/handbooks)
    final_ranked: List[RankedChunk] = []
    doc_chunk_count: Dict[int, int] = defaultdict(int)

    for chunk in scored_candidates:
        doc_id = chunk.document_id
        if doc_chunk_count[doc_id] < max_chunks_per_document:
            doc_chunk_count[doc_id] += 1
            chunk.rank = len(final_ranked) + 1
            final_ranked.append(chunk)
            if len(final_ranked) >= top_k:
                break

    logger.debug("RRF merged %d candidates into %d top ranked chunks", len(merged_chunks), len(final_ranked))
    return final_ranked
