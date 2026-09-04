"""Contract Tests for Server-Sent Events (SSE) Streaming Payloads.

Validates the 5 standardized SSE event schemas conforming to RFC 8895:
1. request.accepted
2. pipeline.status
3. answer.delta
4. answer.completed
5. answer.error
"""

import json
import pytest

from core_ai.contracts.chat import Citation, ExecutionTraceStep, RouteStatus
from core_ai.contracts.events import (
    AnswerCompletedPayload,
    AnswerDeltaPayload,
    AnswerErrorPayload,
    PipelineStatusPayload,
    RequestAcceptedPayload,
    SSEEvent,
    TokenUsageSummary,
)


class TestSSEEventsContract:
    def test_request_accepted_event(self) -> None:
        """request.accepted event acknowledges inbound query."""
        payload = RequestAcceptedPayload(
            request_id="req-uuid-1",
            conversation_id="conv-uuid-1",
            status="accepted",
        )
        event = SSEEvent(event="request.accepted", data=payload)
        sse_frame = event.to_sse_frame()

        assert "event: request.accepted" in sse_frame
        assert '"request_id": "req-uuid-1"' in sse_frame
        assert '"status": "accepted"' in sse_frame

        # Verify to_sse_string() matches to_sse_frame()
        if hasattr(event, "to_sse_string"):
            assert event.to_sse_string() == sse_frame

    def test_pipeline_status_event_vietnamese_labels(self) -> None:
        """pipeline.status emits friendly Vietnamese labels and syncs message_vi."""
        payload = PipelineStatusPayload(
            request_id="req-uuid-1",
            stage="retrieval",
            status="in_progress",
            message="Đang tìm kiếm tài liệu",
            progress_percent=50,
        )
        assert payload.message_vi == "Đang tìm kiếm tài liệu"
        assert payload.progress_percent == 50

        event = SSEEvent(event="pipeline.status", data=payload)
        d = event.to_dict()
        assert d["event"] == "pipeline.status"
        data_dict = json.loads(d["data"]) if isinstance(d["data"], str) else d["data"]
        assert data_dict["stage"] == "retrieval"
        assert event.data.stage == "retrieval"

    def test_answer_delta_event(self) -> None:
        """answer.delta event sends incremental answer text chunks."""
        payload = AnswerDeltaPayload(
            request_id="req-uuid-1",
            delta="Học viện Nông nghiệp ",
            index=0,
        )
        event = SSEEvent(event="answer.delta", data=payload)
        d = event.to_dict()

        assert d["event"] == "answer.delta"
        data_dict = json.loads(d["data"]) if isinstance(d["data"], str) else d["data"]
        assert data_dict["delta"] == "Học viện Nông nghiệp "
        assert data_dict["index"] == 0
        assert event.data.delta == "Học viện Nông nghiệp "

    def test_answer_completed_event(self) -> None:
        """answer.completed event contains final answer, verified citations, trace and usage."""
        payload = AnswerCompletedPayload(
            request_id="req-uuid-1",
            conversation_id="conv-uuid-1",
            status=RouteStatus.ANSWERED,
            answer="Sinh viên cần hoàn thành 125 tín chỉ để tốt nghiệp.",
            confidence=0.95,
            citations=[
                Citation(
                    citation_id="src_1",
                    document_id=10,
                    title="Quy chế đào tạo",
                    snippet="125 tín chỉ",
                )
            ],
            execution_trace=[
                ExecutionTraceStep(step="guardrail", status="passed", latency_ms=10)
            ],
            latency_ms=850,
            usage=TokenUsageSummary(
                prompt_tokens=40,
                completion_tokens=25,
                total_tokens=65,
                external_calls_count=1,
            ),
        )

        event = SSEEvent(event="answer.completed", data=payload)
        d = event.to_dict()

        assert d["event"] == "answer.completed"
        data_dict = json.loads(d["data"]) if isinstance(d["data"], str) else d["data"]
        assert data_dict["status"] == "answered"
        assert len(data_dict["citations"]) == 1
        assert data_dict["usage"]["external_calls_count"] == 1
        assert event.data.status == RouteStatus.ANSWERED

    def test_answer_error_event(self) -> None:
        """answer.error event communicates standardized error codes and safe fallback."""
        payload = AnswerErrorPayload(
            request_id="req-uuid-1",
            code="PROVIDER_TIMEOUT",
            error_code="PROVIDER_TIMEOUT",
            message="Dịch vụ AI phản hồi quá thời gian cho phép",
            retryable=True,
        )
        event = SSEEvent(event="answer.error", data=payload)
        d = event.to_dict()

        assert d["event"] == "answer.error"
        data_dict = json.loads(d["data"]) if isinstance(d["data"], str) else d["data"]
        assert data_dict["error_code"] == "PROVIDER_TIMEOUT"
        assert data_dict["retryable"] is True
        assert event.data.error_code == "PROVIDER_TIMEOUT"
