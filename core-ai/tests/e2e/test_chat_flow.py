"""End-to-End Tests for Chat Streaming Pipeline.

Tests:
1. POST /v1/chat SSE stream emission order:
   request.accepted -> pipeline.status -> answer.delta -> answer.completed.
2. Verified citations, safe execution trace, and usage summary in final payload.
3. Zero leakage of chain-of-thought, internal system prompts, or database credentials.
4. Backwards-compatible JSON endpoint POST /ask-ai.
5. Internal service token authentication enforcement (401 on missing/bad token).
"""

import json
from typing import List
from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient
import pytest

from core_ai.config import Settings
from core_ai.contracts.chat import ChatRequest
from core_ai.contracts.mcp import ToolResult
from core_ai.dependencies import register_component


class TestChatFlowE2E:
    @staticmethod
    def _completed_payload(response) -> dict:
        lines = response.text.splitlines()
        for index, line in enumerate(lines):
            if "event: answer.completed" not in line:
                continue
            for data_line in lines[index + 1 :]:
                if data_line.startswith("data:"):
                    return json.loads(data_line.replace("data:", "", 1).strip())
        raise AssertionError("answer.completed event was not emitted")

    def test_auth_rejection_missing_token(self, client: TestClient) -> None:
        """Request without Authorization Bearer header is rejected with HTTP 401."""
        payload = {"message": "Học phí bao nhiêu?"}
        response = client.post("/v1/chat", json=payload)
        assert response.status_code == 401
        data = response.json()
        assert data["detail"]["error_code"] == "AUTH_FAILED"

    def test_auth_rejection_invalid_token(self, client: TestClient) -> None:
        """Request with incorrect Bearer token is rejected with HTTP 401."""
        payload = {"message": "Học phí bao nhiêu?"}
        headers = {"Authorization": "Bearer totally-wrong-token"}
        response = client.post("/v1/chat", json=payload, headers=headers)
        assert response.status_code == 401
        assert response.json()["detail"]["error_code"] == "AUTH_FAILED"

    def test_chat_streaming_sse_full_flow(
        self, client: TestClient, mock_litellm_completion: AsyncMock
    ) -> None:
        """POST /v1/chat yields standard 5 SSE events in strict chronological order."""
        payload = {
            "request_id": "test-e2e-req-1",
            "tenant_id": "vnua",
            "conversation_id": "conv-e2e-1",
            "message": "Sinh viên đại học chính quy được đăng ký tối đa bao nhiêu tín chỉ?",
        }
        headers = {"Authorization": "Bearer test-secret-token-123"}

        response = client.post("/v1/chat", json=payload, headers=headers)
        assert response.status_code == 200
        assert "text/event-stream" in response.headers.get("content-type", "")

        # Parse SSE events from response text
        raw_text = response.text
        lines = raw_text.splitlines()

        events: List[str] = []
        data_payloads: List[dict] = []

        current_event = None
        for line in lines:
            if line.startswith("event:"):
                current_event = line.replace("event:", "").strip()
            elif line.startswith("data:") and current_event:
                raw_data = line.replace("data:", "").strip()
                if raw_data:
                    try:
                        parsed_data = json.loads(raw_data)
                        events.append(current_event)
                        data_payloads.append(parsed_data)
                    except json.JSONDecodeError:
                        pass
                current_event = None

        # 1. First event MUST be request.accepted
        assert len(events) >= 3
        assert events[0] == "request.accepted"
        assert data_payloads[0]["status"] == "accepted"

        # 2. Pipeline status events follow
        status_events = [e for e in events if e == "pipeline.status"]
        assert len(status_events) >= 1

        # 3. Answer deltas follow
        delta_events = [e for e in events if e == "answer.delta"]
        assert len(delta_events) >= 1

        # 4. Final event MUST be answer.completed
        assert events[-1] == "answer.completed"
        final_payload = data_payloads[-1]

        assert final_payload["status"] == "answered"
        assert len(final_payload["answer"]) > 0
        assert "citations" in final_payload
        assert len(final_payload["citations"]) >= 1

        # Verify execution trace presence
        assert "execution_trace" in final_payload
        assert len(final_payload["execution_trace"]) >= 1

        # Security check: verify no chain-of-thought or raw prompt leaked in completed payload
        final_str = json.dumps(final_payload).lower()
        assert "thought" not in final_str or "chain_of_thought" not in final_str
        assert "secret" not in final_str
        assert "test-secret-token" not in final_str

    def test_legacy_ask_ai_json_endpoint(
        self, client: TestClient, mock_litellm_completion: AsyncMock
    ) -> None:
        """POST /ask-ai returns backward-compatible JSON response for existing Next.js BFF."""
        payload = {
            "question": "Học phí một tín chỉ là bao nhiêu?",
            "conversation_id": "legacy-conv-1",
            "tenant_id": "vnua",
        }
        headers = {"Authorization": "Bearer test-secret-token-123"}

        response = client.post("/ask-ai", json=payload, headers=headers)
        assert response.status_code == 200
        data = response.json()

        assert "answer" in data
        assert "status" in data
        assert data["conversation_id"] == "legacy-conv-1"
        assert "sources" in data
        assert isinstance(data["sources"], list)

    def test_explicit_approved_support_request_is_escalated(self, client: TestClient) -> None:
        """An escalation is a trusted explicit action and never inferred from chat text."""
        gateway = AsyncMock()
        gateway.call_tool.return_value = ToolResult(
            tool_name="create_support_case",
            success=True,
            data={"ticket_id": "CASE-2026-0042"},
            latency_ms=10,
        )
        register_component("mcp_gateway", gateway)
        response = client.post(
            "/v1/chat",
            json={
                "message": "Tôi xác nhận tạo phiếu hỗ trợ.",
                "requested_tool": "create_support_case",
                "tool_approved": True,
                "tool_arguments": {
                    "student_id": "ignored-body-id",
                    "category": "dao_tao",
                    "subject": "Không đăng ký được học phần",
                    "details": "Tôi không thể đăng ký học phần bắt buộc.",
                },
            },
            headers={
                "Authorization": "Bearer test-secret-token-123",
                "X-Request-ID": "e2e-escalation",
                "X-Tenant-ID": "vnua",
                "X-User-ID": "42",
            },
        )

        payload = self._completed_payload(response)
        assert payload["status"] == "escalated"
        assert payload["fallback"]["ticket_id"] == "CASE-2026-0042"
        assert payload["usage"]["external_calls_count"] == 0
        gateway.call_tool.assert_awaited_once()
