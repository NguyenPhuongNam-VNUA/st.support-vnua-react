from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from core_ai.data.repositories.question_repo import QuestionRecord
from core_ai.graph.nodes.retrieval_node import retrieval_node
from core_ai.graph.state import create_initial_state


@pytest.mark.asyncio
async def test_retrieval_includes_approved_embedded_faq() -> None:
    faq = QuestionRecord(
        id=42,
        question="Sinh viên được đăng ký tối đa bao nhiêu tín chỉ?",
        answer="Sinh viên được đăng ký tối đa 24 tín chỉ.",
        topic="Đăng ký học phần",
        status="approved",
        similarity=0.94,
        source_document_id=7,
        source_article="Điều 12",
        source_clause="Khoản 2",
    )
    vector_retriever = MagicMock()
    vector_retriever.search_faq = AsyncMock(return_value=[faq])
    hybrid = MagicMock()
    hybrid.vector_retriever = vector_retriever
    hybrid.retrieve_parallel = AsyncMock(return_value=([], []))
    settings = MagicMock(retrieval_top_k=5)
    state = create_initial_state("req-1", faq.question)
    state["query_embedding"] = [0.1] * 128

    with (
        patch("core_ai.graph.nodes.retrieval_node.get_component", return_value=hybrid),
        patch("core_ai.graph.nodes.retrieval_node.get_settings", return_value=settings),
    ):
        result = await retrieval_node(state)

    assert result["retrieved_chunks"][0]["source_type"] == "faq"
    assert "24 tín chỉ" in result["retrieved_chunks"][0]["snippet"]
    assert result["citations"][0].article == "Điều 12"
    vector_retriever.search_faq.assert_awaited_once()
