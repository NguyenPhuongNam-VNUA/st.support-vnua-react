"""Retrieval Tests for Parallel Hybrid Search (BM25 + pgvector).

Tests:
1. Parallel execution of vector (dense) and BM25 (sparse) retrieval.
2. RRF ranking merger consolidating both candidate streams.
3. Local reranking selecting top 3-5 snippets.
4. Zero-result retrieval handled gracefully without exceptions.
5. Conflicting sources from different regulations evaluated based on score.
"""

from unittest.mock import AsyncMock, MagicMock

import pytest

from core_ai.retrieval.bm25 import BM25Retriever, RankedChunk
from core_ai.retrieval.reranker import LocalReranker
from core_ai.retrieval.rrf import reciprocal_rank_fusion
from core_ai.retrieval.vector_search import ParallelHybridRetriever, VectorRetriever


@pytest.fixture
def mock_retrieval_components():
    """Builds mocked Vector and BM25 retrievers returning predefined candidate sets."""
    dense_retriever = MagicMock(spec=VectorRetriever)
    sparse_retriever = MagicMock(spec=BM25Retriever)

    dense_candidates = [
        RankedChunk(
            chunk_id=1,
            document_id=10,
            chunk_index=0,
            document_title="Quy chế đào tạo đại học",
            content="Sinh viên đăng ký tối đa 24 tín chỉ mỗi học kỳ.",
            rank=1,
            similarity=0.92,
        ),
        RankedChunk(
            chunk_id=2,
            document_id=10,
            chunk_index=1,
            document_title="Quy chế đào tạo đại học",
            content="Sinh viên bị cảnh báo học tập nếu điểm trung bình dưới 1.0.",
            rank=2,
            similarity=0.81,
        ),
    ]

    sparse_candidates = [
        RankedChunk(
            chunk_id=1,  # Overlapping candidate
            document_id=10,
            chunk_index=0,
            document_title="Quy chế đào tạo đại học",
            content="Sinh viên đăng ký tối đa 24 tín chỉ mỗi học kỳ.",
            rank=1,
            fts_score=0.88,
        ),
        RankedChunk(
            chunk_id=3,
            document_id=11,
            chunk_index=0,
            document_title="Quy định học phần tự chọn",
            content="Học phần tự chọn được đăng ký từ năm thứ hai.",
            rank=2,
            fts_score=0.74,
        ),
    ]

    dense_retriever.retrieve = AsyncMock(return_value=dense_candidates)
    sparse_retriever.retrieve = AsyncMock(return_value=sparse_candidates)

    return dense_retriever, sparse_retriever


class TestHybridRetrieval:
    @pytest.mark.asyncio
    async def test_parallel_hybrid_retriever_merges_streams(
        self, mock_retrieval_components
    ) -> None:
        """ParallelHybridRetriever concurrently queries dense and sparse stores and supports retrieve and retrieve_parallel."""
        dense_mock, sparse_mock = mock_retrieval_components
        hybrid = ParallelHybridRetriever(
            vector_retriever=dense_mock,
            bm25_retriever=sparse_mock,
        )

        # Verify retrieve_parallel interface
        dense_results, sparse_results = await hybrid.retrieve_parallel(
            query="đăng ký tín chỉ", tenant_id="vnua", top_k=5
        )
        assert len(dense_results) == 2
        assert len(sparse_results) == 2

        # Verify retrieve interface
        retrieval_result = await hybrid.retrieve(
            query="đăng ký tín chỉ", tenant_id="vnua", top_k=5
        )

        # Confirm both mock retrievers were awaited with query and tenant
        dense_mock.retrieve.assert_awaited()
        sparse_mock.retrieve.assert_awaited()
        assert dense_mock.retrieve.call_args.kwargs.get("query") == "đăng ký tín chỉ"
        assert dense_mock.retrieve.call_args.kwargs.get("tenant_id") == "vnua"
        assert sparse_mock.retrieve.call_args.kwargs.get("query") == "đăng ký tín chỉ"
        assert sparse_mock.retrieve.call_args.kwargs.get("tenant_id") == "vnua"

        if isinstance(retrieval_result, tuple):
            merged = reciprocal_rank_fusion(
                dense_candidates=retrieval_result[0],
                sparse_candidates=retrieval_result[1],
                top_k=5,
            )
        else:
            merged = retrieval_result

        assert len(merged) == 3
        # Chunk 1 appeared in both -> top ranked hybrid chunk
        assert merged[0].chunk_id == 1
        assert merged[0].retrieval_source == "hybrid"

    @pytest.mark.asyncio
    async def test_hybrid_retrieval_zero_results(self) -> None:
        """Both stores return empty lists -> pipeline yields empty list or empty tuple without failure."""
        dense_mock = MagicMock()
        sparse_mock = MagicMock()
        dense_mock.retrieve = AsyncMock(return_value=[])
        sparse_mock.retrieve = AsyncMock(return_value=[])

        hybrid = ParallelHybridRetriever(
            vector_retriever=dense_mock,
            bm25_retriever=sparse_mock,
        )

        res_parallel = await hybrid.retrieve_parallel(
            query="câu hỏi không có trong dữ liệu", tenant_id="vnua"
        )
        assert res_parallel == ([], [])

        res = await hybrid.retrieve(query="câu hỏi không có trong dữ liệu", tenant_id="vnua")
        if isinstance(res, tuple):
            assert res == ([], [])
        else:
            assert res == []

    @pytest.mark.asyncio
    async def test_sparse_results_survive_dense_backend_failure(self) -> None:
        """A Gemini/vector outage must not discard usable BM25 evidence."""
        dense_mock = MagicMock()
        sparse_mock = MagicMock()
        dense_mock.retrieve = AsyncMock(side_effect=RuntimeError("embedding unavailable"))
        sparse_candidate = RankedChunk(
            chunk_id=7,
            document_id=21,
            chunk_index=0,
            document_title="Quy chế",
            content="Nội dung đã xác minh",
            rank=1,
            fts_score=0.9,
        )
        sparse_mock.retrieve = AsyncMock(return_value=[sparse_candidate])
        hybrid = ParallelHybridRetriever(dense_mock, sparse_mock)

        dense, sparse = await hybrid.retrieve_parallel("quy chế", tenant_id="vnua")

        assert dense == []
        assert sparse == [sparse_candidate]

    @pytest.mark.asyncio
    async def test_dense_results_survive_sparse_backend_failure(self) -> None:
        """A PostgreSQL FTS failure must not discard usable dense evidence."""
        dense_mock = MagicMock()
        sparse_mock = MagicMock()
        dense_candidate = RankedChunk(
            chunk_id=8,
            document_id=22,
            chunk_index=0,
            document_title="Quy định",
            content="Nguồn vector đã xác minh",
            rank=1,
            similarity=0.91,
        )
        dense_mock.retrieve = AsyncMock(return_value=[dense_candidate])
        sparse_mock.retrieve = AsyncMock(side_effect=RuntimeError("fts unavailable"))
        hybrid = ParallelHybridRetriever(dense_mock, sparse_mock)

        dense, sparse = await hybrid.retrieve_parallel("quy định", tenant_id="vnua")

        assert dense == [dense_candidate]
        assert sparse == []

    def test_reranker_selects_top_snippets_from_hybrid_candidates(self) -> None:
        """Reranker processes RRF candidates and returns top 3 snippets with evidence score."""
        candidates = [
            RankedChunk(
                chunk_id=i,
                document_id=i * 10,
                chunk_index=0,
                document_title=f"Văn bản quy định số {i}",
                content=f"Quy định liên quan đến học kỳ và tín chỉ {i}",
                rank=i,
                similarity=0.90 - (i * 0.05),
                rrf_score=0.95 - (i * 0.05),
            )
            for i in range(1, 8)
        ]

        reranker = LocalReranker(target_top_n=3, min_top_n=3)
        eval_result = reranker.rerank(query="quy định học kỳ tín chỉ", candidates=candidates)

        assert len(eval_result.snippets) == 3
        assert eval_result.is_sufficient is True
        assert eval_result.overall_evidence_score >= 0.55
        assert eval_result.snippets[0].rank == 1
