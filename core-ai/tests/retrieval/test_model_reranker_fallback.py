from core_ai.retrieval.bm25 import RankedChunk
from core_ai.retrieval.model_reranker import ModelReranker


def test_missing_bge_keeps_top_three_deterministic(mock_settings, tmp_path) -> None:
    mock_settings.bge_reranker_model_path = str(tmp_path / "missing-model")
    reranker = ModelReranker(mock_settings)
    candidates = [
        RankedChunk(
            chunk_id=index,
            document_id=1,
            chunk_index=index,
            content=f"quy định học phí học kỳ {index}",
            rank=index,
            rrf_score=1.0 / index,
        )
        for index in range(1, 6)
    ]
    assert reranker.load() is False
    result = reranker.rerank("quy định học phí học kỳ", candidates, target_top_n=3)
    assert result.strategy == "heuristic_fallback"
    assert len(result.snippets) == 3
