"""Unit Tests for Local Reranker and Evidence Score Evaluation.

Tests:
1. Evidence sufficiency decision threshold (`min_evidence_score=0.55`).
2. Empty candidate list returns zero score and `is_sufficient=False`.
3. High relevance snippets containing exact phrase match yield high score and `is_sufficient=True`.
4. Irrelevant snippets fail sufficiency threshold.
5. Extraction and ranking of top 3-5 snippets.
"""

import pytest

from core_ai.retrieval.bm25 import RankedChunk
from core_ai.retrieval.reranker import EvidenceEvaluationResult, LocalReranker


@pytest.fixture
def reranker() -> LocalReranker:
    return LocalReranker(
        min_evidence_score=0.55,
        min_snippet_score=0.30,
        target_top_n=5,
        min_top_n=3,
    )


class TestEvidenceScoreEvaluation:
    def test_reranker_empty_candidates_returns_insufficient(self, reranker: LocalReranker) -> None:
        """When retrieval returns no snippets, score is 0.0 and sufficiency is False."""
        res: EvidenceEvaluationResult = reranker.rerank("Học phí kỳ 1 bao nhiêu?", [])
        assert res.overall_evidence_score == 0.0
        assert res.is_sufficient is False
        assert len(res.snippets) == 0
        assert res.top_score == 0.0

    def test_reranker_sufficient_high_relevance(self, reranker: LocalReranker) -> None:
        """Relevant snippet with high token match and vector similarity yields is_sufficient=True."""
        candidates = [
            RankedChunk(
                chunk_id=1,
                document_id=10,
                chunk_index=0,
                document_title="Quy định học phí VNUA 2024",
                content="Mức thu học phí đối với sinh viên chính quy hệ đại học kỳ 1 là 350.000 đồng một tín chỉ.",
                rank=1,
                similarity=0.92,
                rrf_score=0.95,
            ),
            RankedChunk(
                chunk_id=2,
                document_id=10,
                chunk_index=1,
                document_title="Quy định học phí VNUA 2024",
                content="Thời hạn hoàn thành nghĩa vụ học phí là 30 ngày kể từ ngày bắt đầu học kỳ.",
                rank=2,
                similarity=0.85,
                rrf_score=0.88,
            ),
        ]

        query = "mức thu học phí kỳ 1"
        res = reranker.rerank(query, candidates)

        assert res.is_sufficient is True
        assert res.overall_evidence_score >= 0.55
        assert res.has_high_relevance_source is True
        assert len(res.snippets) == 2
        assert res.snippets[0].chunk_id == 1

    def test_reranker_insufficient_low_relevance(self, reranker: LocalReranker) -> None:
        """Completely unrelated text yields low score below threshold, marking is_sufficient=False."""
        candidates = [
            RankedChunk(
                chunk_id=10,
                document_id=50,
                chunk_index=0,
                document_title="Hướng dẫn gửi xe đạp",
                content="Nhà xe số 2 dành cho cán bộ công nhân viên và khách liên hệ công tác.",
                rank=1,
                similarity=0.20,
                rrf_score=0.30,
            )
        ]

        query = "Điều kiện chuyển ngành đào tạo của sinh viên"
        res = reranker.rerank(query, candidates)

        assert res.is_sufficient is False
        assert res.overall_evidence_score < 0.55

    def test_reranker_phrase_bonus(self, reranker: LocalReranker) -> None:
        """Verifies that an exact phrase match in content elevates the score."""
        query = "đăng ký 24 tín chỉ"
        chunk_with_exact_phrase = RankedChunk(
            chunk_id=1,
            document_id=1,
            chunk_index=0,
            document_title="Quy chế",
            content="Sinh viên được phép đăng ký 24 tín chỉ trong mỗi học kỳ.",
            rank=1,
            similarity=0.7,
            rrf_score=0.7,
        )
        chunk_without_phrase = RankedChunk(
            chunk_id=2,
            document_id=2,
            chunk_index=0,
            document_title="Quy chế",
            content="Quy định về việc đăng ký các học phần và số lượng tín chỉ đào tạo.",
            rank=2,
            similarity=0.7,
            rrf_score=0.7,
        )

        score_exact = reranker._score_snippet(query, ["đăng", "ký", "24", "tín", "chỉ"], chunk_with_exact_phrase)
        score_diff = reranker._score_snippet(query, ["đăng", "ký", "24", "tín", "chỉ"], chunk_without_phrase)

        assert score_exact > score_diff

    def test_reranker_caps_to_target_top_n(self, reranker: LocalReranker) -> None:
        """Target top snippets count (default 5) is respected."""
        candidates = [
            RankedChunk(
                chunk_id=i,
                document_id=10,
                chunk_index=i,
                document_title=f"Doc {i}",
                content=f"Nội dung quy định liên quan học kỳ chính {i}",
                rank=i,
                similarity=0.85,
                rrf_score=0.85,
            )
            for i in range(1, 10)
        ]

        res = reranker.rerank("quy định học kỳ chính", candidates, target_top_n=4)
        assert len(res.snippets) <= 4
