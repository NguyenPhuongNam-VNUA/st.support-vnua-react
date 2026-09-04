"""Unit Tests for Reciprocal Rank Fusion (RRF) algorithm.

Tests:
1. Mathematical correctness of RRF scoring formula: sum( weight / (k + rank) ).
2. Deduplication and merging of dense (pgvector) and sparse (BM25) candidates.
3. Hybrid classification: chunks appearing in both candidate lists are tagged 'hybrid'.
4. Empty and single-source edge cases.
5. Document source capping (diversity enforcement).
6. Respect for top_k truncation limits.
"""

import pytest

from core_ai.retrieval.bm25 import RankedChunk
from core_ai.retrieval.rrf import reciprocal_rank_fusion


def create_chunk(
    chunk_id: int,
    doc_id: int,
    rank: int,
    title: str = "Doc",
    content: str = "Content",
    similarity: float = 0.8,
    fts_score: float = 0.8,
) -> RankedChunk:
    return RankedChunk(
        chunk_id=chunk_id,
        document_id=doc_id,
        chunk_index=chunk_id,
        document_title=title,
        content=content,
        rank=rank,
        similarity=similarity,
        fts_score=fts_score,
    )


class TestReciprocalRankFusion:
    def test_rrf_empty_inputs_returns_empty_list(self) -> None:
        """Edge case: zero candidates from both dense and sparse retrieval."""
        result = reciprocal_rank_fusion(dense_candidates=[], sparse_candidates=[])
        assert result == []

    def test_rrf_single_source_dense_only(self) -> None:
        """Dense candidates only; sparse candidates empty."""
        dense = [
            create_chunk(chunk_id=1, doc_id=10, rank=1, similarity=0.9),
            create_chunk(chunk_id=2, doc_id=10, rank=2, similarity=0.8),
        ]
        result = reciprocal_rank_fusion(dense_candidates=dense, sparse_candidates=[], k=60)

        assert len(result) == 2
        assert result[0].chunk_id == 1
        assert result[0].rank == 1
        assert result[0].retrieval_source == "dense"
        assert result[0].rrf_score is not None
        assert result[0].rrf_score > result[1].rrf_score

    def test_rrf_single_source_sparse_only(self) -> None:
        """Sparse candidates only; dense candidates empty."""
        sparse = [
            create_chunk(chunk_id=5, doc_id=20, rank=1, fts_score=0.95),
            create_chunk(chunk_id=6, doc_id=20, rank=2, fts_score=0.75),
        ]
        result = reciprocal_rank_fusion(dense_candidates=[], sparse_candidates=sparse, k=60)

        assert len(result) == 2
        assert result[0].chunk_id == 5
        assert result[0].retrieval_source == "sparse"
        assert result[0].rank == 1

    def test_rrf_deduplication_and_hybrid_tagging(self) -> None:
        """Chunks appearing in both dense and sparse lists must be deduplicated and tagged 'hybrid'."""
        dense = [
            create_chunk(chunk_id=1, doc_id=100, rank=1, similarity=0.92),
            create_chunk(chunk_id=2, doc_id=101, rank=2, similarity=0.81),
        ]
        sparse = [
            create_chunk(chunk_id=1, doc_id=100, rank=1, fts_score=0.88),  # Duplicate chunk_id 1
            create_chunk(chunk_id=3, doc_id=102, rank=2, fts_score=0.84),
        ]

        result = reciprocal_rank_fusion(dense_candidates=dense, sparse_candidates=sparse, k=60)

        # Unique chunk IDs: 1, 2, 3
        assert len(result) == 3
        top_chunk = result[0]
        assert top_chunk.chunk_id == 1
        assert top_chunk.retrieval_source == "hybrid"
        # Since it appeared rank 1 in both, its score must be the highest possible (normalized ~ 1.0)
        assert top_chunk.rrf_score == pytest.approx(1.0, rel=1e-3)

    def test_rrf_document_source_capping(self) -> None:
        """Enforces document diversity by capping the number of chunks from the same document."""
        # 4 chunks from document 100
        dense = [
            create_chunk(chunk_id=1, doc_id=100, rank=1),
            create_chunk(chunk_id=2, doc_id=100, rank=2),
            create_chunk(chunk_id=3, doc_id=100, rank=3),
            create_chunk(chunk_id=4, doc_id=100, rank=4),
            create_chunk(chunk_id=5, doc_id=200, rank=5),  # Different document
        ]

        result = reciprocal_rank_fusion(
            dense_candidates=dense,
            sparse_candidates=[],
            k=60,
            max_chunks_per_document=2,
            top_k=3,
        )

        # First 2 should be from doc 100, 3rd from doc 200
        assert len(result) == 3
        doc_ids = [c.document_id for c in result]
        assert doc_ids == [100, 100, 200]

    def test_rrf_respects_top_k_limit(self) -> None:
        """Result length must not exceed requested top_k."""
        dense = [create_chunk(chunk_id=i, doc_id=i * 10, rank=i) for i in range(1, 15)]
        sparse = [create_chunk(chunk_id=i + 50, doc_id=i * 20, rank=i) for i in range(1, 15)]

        result = reciprocal_rank_fusion(dense_candidates=dense, sparse_candidates=sparse, top_k=5)
        assert len(result) == 5
        # Verify rank sequence 1 to 5
        assert [c.rank for c in result] == [1, 2, 3, 4, 5]
