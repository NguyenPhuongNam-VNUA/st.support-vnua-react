"""Contract Tests for Chat Request and Response Schemas.

Verifies frozen Pydantic contracts between Next.js BFF and core-ai microservice:
1. ChatRequest: mandatory and optional fields, Unicode normalization, bounds.
2. ChatResponse: complete response schema, RouteStatus enum, citations, execution trace.
3. Citation: attribution schema, relevance score boundaries.
4. ExecutionTraceStep: safe trace step structure without leaking sensitive prompts.
5. LegacyAskAiRequest: compatibility with legacy BFF payload.
"""

import pytest
from pydantic import ValidationError

from core_ai.contracts.chat import (
    ChatRequest,
    ChatResponse,
    Citation,
    ExecutionTraceStep,
    LegacyAskAiRequest,
    RouteStatus,
)


class TestChatContracts:
    def test_chat_request_valid_minimal(self) -> None:
        """ChatRequest requires only 'message'; other fields have defaults."""
        req = ChatRequest(message="Lịch thi học kỳ 2")
        assert req.message == "Lịch thi học kỳ 2"
        assert req.tenant_id == "vnua"
        assert req.locale == "vi-VN"
        assert req.channel == "web"
        assert req.request_id is not None

    def test_chat_request_rejects_empty_message(self) -> None:
        """ChatRequest fails validation on empty or whitespace message."""
        with pytest.raises(ValidationError):
            ChatRequest(message="   ")

    def test_chat_request_unicode_normalization(self) -> None:
        """ChatRequest normalizes message to NFC format automatically."""
        req = ChatRequest(message="Học\u200Bviện\uFEFF")
        assert "\u200B" not in req.message
        assert "\uFEFF" not in req.message

    def test_citation_model_validation(self) -> None:
        """Citation requires citation_id, document_id, title, snippet."""
        cit = Citation(
            citation_id="src_1",
            document_id=101,
            title="Quy chế đào tạo",
            snippet="Sinh viên được phép rút học phần trước tuần thứ 4.",
            page=5,
            relevance_score=0.91,
        )
        assert cit.citation_id == "src_1"
        assert cit.document_id == 101
        assert cit.page == 5
        assert cit.relevance_score == 0.91

    def test_citation_relevance_score_bounds(self) -> None:
        """Relevance score must be within [0.0, 1.0]."""
        with pytest.raises(ValidationError):
            Citation(
                citation_id="src_1",
                document_id=1,
                title="Doc",
                snippet="Text",
                relevance_score=1.5,
            )

    def test_execution_trace_step_validation(self) -> None:
        """ExecutionTraceStep records step, status, and latency_ms."""
        step = ExecutionTraceStep(
            step="retrieval",
            status="completed",
            latency_ms=85,
            details={"snippets_count": 4},
        )
        assert step.step == "retrieval"
        assert step.status == "completed"
        assert step.latency_ms == 85
        assert step.details == {"snippets_count": 4}

    def test_chat_response_contract(self) -> None:
        """ChatResponse includes all required fields and respects RouteStatus enum."""
        resp = ChatResponse(
            request_id="req-1234",
            conversation_id="conv-5678",
            status=RouteStatus.ANSWERED,
            answer="Học phí được nộp trực tuyến qua cổng sinh viên.",
            confidence=0.94,
            citations=[
                Citation(
                    citation_id="src_1",
                    document_id=202,
                    title="Quy chế thu học phí",
                    snippet="Nộp trực tuyến",
                )
            ],
            execution_trace=[
                ExecutionTraceStep(step="guardrail", status="passed", latency_ms=10),
                ExecutionTraceStep(step="retrieval", status="completed", latency_ms=60),
            ],
            fallback=None,
            latency_ms=750,
        )

        assert resp.status == RouteStatus.ANSWERED
        assert resp.confidence == 0.94
        assert len(resp.citations) == 1
        assert len(resp.execution_trace) == 2

    def test_legacy_ask_ai_request(self) -> None:
        """LegacyAskAiRequest correctly parses question field from old BFF."""
        legacy = LegacyAskAiRequest(
            question="Lịch đăng ký môn học?",
            conversation_id="legacy-conv-1",
            tenant_id="vnua",
        )
        assert legacy.question == "Lịch đăng ký môn học?"
        assert legacy.conversation_id == "legacy-conv-1"
