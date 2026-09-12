from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from core_ai.data.repositories.question_repo import QuestionRecord
from core_ai.graph.nodes.generation_node import build_evidence_context
from core_ai.graph.nodes.guardrail_node import output_guardrail_node
from core_ai.graph.nodes.retrieval_node import retrieval_node
from core_ai.graph.nodes.topic_scoring_node import topic_scoring_node
from core_ai.graph.state import create_initial_state
from core_ai.retrieval.bm25 import RankedChunk


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
    assert result["retrieved_chunks"][0]["article"] is None
    assert result["citations"] == []
    assert result["retrieval_route"] == "faq_and_document"
    assert "deterministic_semantic_lexical_rerank" in result["retrieved_chunks"][0][
        "selection_reason"
    ]
    hybrid.retrieve_parallel.assert_awaited_once()
    vector_retriever.search_faq.assert_awaited_once()
    assert vector_retriever.search_faq.await_args.kwargs["min_similarity"] == 0.65
    assert vector_retriever.search_faq.await_args.kwargs["top_k"] == 10


@pytest.mark.asyncio
async def test_retrieval_covers_each_explicit_faq_facet() -> None:
    scholarship = QuestionRecord(
        id=1,
        question="Sinh viên có những loại học bổng nào?",
        answer="Có học bổng khuyến khích học tập.",
        topic="Học bổng",
        status="approved",
        similarity=0.75,
    )
    unrelated = QuestionRecord(
        id=2,
        question="Phương thức tuyển sinh là gì?",
        answer="Xem đề án tuyển sinh.",
        topic="Tuyển sinh",
        status="approved",
        similarity=0.74,
    )
    tuition = QuestionRecord(
        id=3,
        question="Mức học phí theo ngành được tính thế nào?",
        answer="Học phí được công bố theo ngành và khóa học.",
        topic="Học phí",
        status="approved",
        similarity=0.69,
    )
    vector_retriever = MagicMock()
    vector_retriever.search_faq = AsyncMock(
        return_value=[scholarship, unrelated, tuition]
    )
    hybrid = MagicMock()
    hybrid.vector_retriever = vector_retriever
    hybrid.retrieve_parallel = AsyncMock(return_value=([], []))
    settings = MagicMock(retrieval_top_k=2)
    state = create_initial_state(
        "req-2", "Mức học phí theo ngành và các loại học bổng sinh viên có thể nhận?"
    )
    state["query_embedding"] = [0.1] * 128

    with (
        patch("core_ai.graph.nodes.retrieval_node.get_component", return_value=hybrid),
        patch("core_ai.graph.nodes.retrieval_node.get_settings", return_value=settings),
    ):
        result = await retrieval_node(state)

    snippets = "\n".join(item["snippet"] for item in result["retrieved_chunks"])
    assert "học bổng" in snippets
    assert "học phí" in snippets
    assert "tuyển sinh" not in snippets
    hybrid.retrieve_parallel.assert_awaited_once()


@pytest.mark.asyncio
async def test_combines_faq_and_document_then_cites_only_document() -> None:
    low_similarity_faq = QuestionRecord(
        id=4,
        question="Học phí được tính thế nào?",
        answer="Xem quy định học phí.",
        status="approved",
        similarity=0.69,
    )
    document_chunk = RankedChunk(
        chunk_id="chunk-1",
        document_id="doc-1",
        chunk_index=0,
        document_title="Quy định học phí",
        content="Mức học phí được quy định theo ngành và khóa học.",
        similarity=0.82,
        rank=1,
        retrieval_source="dense",
        source_type="document",
    )
    vector_retriever = MagicMock()
    vector_retriever.search_faq = AsyncMock(return_value=[low_similarity_faq])
    hybrid = MagicMock()
    hybrid.vector_retriever = vector_retriever
    hybrid.retrieve_parallel = AsyncMock(return_value=([document_chunk], []))
    settings = MagicMock(retrieval_top_k=3)
    state = create_initial_state("req-3", "Học phí ngành Công nghệ thông tin")
    state["query_embedding"] = [0.1] * 128

    with (
        patch("core_ai.graph.nodes.retrieval_node.get_component", return_value=hybrid),
        patch("core_ai.graph.nodes.retrieval_node.get_settings", return_value=settings),
    ):
        result = await retrieval_node(state)

    assert result["retrieval_route"] == "faq_and_document"
    assert {item["source_type"] for item in result["retrieved_chunks"]} == {
        "document",
        "faq",
    }
    assert len(result["citations"]) == 1
    assert result["citations"][0].source_type == "document"
    hybrid.retrieve_parallel.assert_awaited_once()


@pytest.mark.asyncio
async def test_faq_ranking_keeps_a_relevant_document_source() -> None:
    faqs = [
        QuestionRecord(
            id=index,
            question=f"Câu hỏi học bổng {index}",
            answer="Điều kiện nhận học bổng.",
            status="approved",
            similarity=0.95 - index / 100,
        )
        for index in range(1, 5)
    ]
    document_chunk = RankedChunk(
        chunk_id="chunk-scholarship",
        document_id=3,
        chunk_index=170,
        page=106,
        document_title="Sổ tay sinh viên K69",
        content="Điều kiện xét học bổng khuyến khích học tập cho sinh viên.",
        similarity=0.8,
        rank=1,
        retrieval_source="dense",
        source_type="document",
    )
    vector_retriever = MagicMock()
    vector_retriever.search_faq = AsyncMock(return_value=faqs)
    hybrid = MagicMock()
    hybrid.vector_retriever = vector_retriever
    hybrid.retrieve_parallel = AsyncMock(return_value=([document_chunk], []))
    settings = MagicMock(retrieval_top_k=3)
    state = create_initial_state("req-doc-coverage", "Điều kiện học bổng K69")
    state["query_embedding"] = [0.1] * 128

    with (
        patch("core_ai.graph.nodes.retrieval_node.get_component", return_value=hybrid),
        patch("core_ai.graph.nodes.retrieval_node.get_settings", return_value=settings),
    ):
        result = await retrieval_node(state)

    assert len(result["retrieved_chunks"]) == 3
    assert any(item["source_type"] == "document" for item in result["retrieved_chunks"])
    assert len(result["citations"]) == 1
    assert result["citations"][0].document_id == 3


@pytest.mark.asyncio
async def test_unlisted_academic_topic_continues_to_retrieval() -> None:
    state = create_initial_state(
        "req-general-academic",
        "Thủ tục đăng ký ở ký túc xá và chi phí dịch vụ ra sao?",
    )
    state["normalized_query"] = state["message"]
    state["query_terms"] = state["message"].lower().split()
    state["user_intent"] = "academic"

    with patch(
        "core_ai.graph.nodes.topic_scoring_node.get_settings",
        return_value=MagicMock(topic_in_domain_threshold=0.38, topic_clarify_threshold=0.52),
    ):
        result = await topic_scoring_node(state)

    assert result["topic"] == "general_academic"
    assert result["is_in_domain"] is True


@pytest.mark.asyncio
async def test_corrective_retry_does_not_discard_better_document_evidence() -> None:
    document_chunk = RankedChunk(
        chunk_id="chunk-ktx",
        document_id=3,
        chunk_index=159,
        page=104,
        document_title="Sổ tay sinh viên K69",
        content="Thông tin ký túc xá và đơn vị hỗ trợ sinh viên.",
        similarity=0.74,
        rank=1,
        retrieval_source="dense",
        source_type="document",
    )
    hybrid = MagicMock()
    hybrid.vector_retriever = MagicMock()
    hybrid.vector_retriever.search_faq = AsyncMock(return_value=[])
    hybrid.retrieve_parallel = AsyncMock(side_effect=[([document_chunk], []), ([], [])])
    settings = MagicMock(retrieval_top_k=3)
    state = create_initial_state("req-corrective", "Thông tin ký túc xá")
    state["query_embedding"] = [0.1] * 128

    with (
        patch("core_ai.graph.nodes.retrieval_node.get_component", return_value=hybrid),
        patch("core_ai.graph.nodes.retrieval_node.get_settings", return_value=settings),
    ):
        first = await retrieval_node(state)
        original_citation = first["citations"][0]
        second = await retrieval_node(first)

    assert second["retrieval_attempts"] == 2
    assert second["retrieved_chunks"][0]["document_id"] == 3
    assert second["citations"] == [original_citation]
    assert second["execution_trace"][-1].details["retained_previous"] is True


def test_faq_prompt_context_has_no_document_provenance() -> None:
    context = build_evidence_context(
        [
            {
                "source_type": "faq",
                "citation_id": "faq_42",
                "snippet": "Câu hỏi đã duyệt và câu trả lời.",
                "issued_date": "2026-01-01",
                "article": "Điều 12",
            }
        ]
    )

    assert "FAQ ĐÃ DUYỆT" in context
    assert "src_" not in context
    assert "ngày ban hành" not in context
    assert "Điều 12" not in context


@pytest.mark.asyncio
async def test_faq_only_output_does_not_require_document_citation() -> None:
    guardrail = MagicMock()
    guardrail.validate.return_value = SimpleNamespace(
        sanitized_answer="Sinh viên đăng ký học phần trực tuyến.",
        validated_citations=[],
        is_safe=True,
    )
    state = create_initial_state("req-4", "Đăng ký học phần thế nào?")
    state["user_intent"] = "academic"
    state["answer"] = "Sinh viên đăng ký học phần trực tuyến."
    state["retrieved_chunks"] = [
        {
            "citation_id": "faq_42",
            "source_type": "faq",
            "snippet": "Sinh viên đăng ký học phần trực tuyến.",
        }
    ]

    with patch(
        "core_ai.graph.nodes.guardrail_node.get_component",
        side_effect=lambda name: guardrail if name == "output_guardrail" else None,
    ):
        await output_guardrail_node(state)

    assert guardrail.validate.call_args.kwargs["require_citations"] is False
    assert state["citations"] == []
