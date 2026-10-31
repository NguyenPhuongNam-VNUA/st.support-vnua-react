"""Security tests for bounded bodies, replay protection, and local rate limiting."""

import pytest

from core_ai.config import Settings
from core_ai.data.request_control import RequestController
from core_ai.dependencies import register_component


@pytest.mark.asyncio
async def test_duplicate_request_id_is_rejected_without_redis(mock_settings: Settings) -> None:
    controller = RequestController(settings=mock_settings)
    assert await controller.claim_request("vnua", "same-request") is True
    assert await controller.claim_request("vnua", "same-request") is False


@pytest.mark.asyncio
async def test_local_rate_limit_is_bounded(mock_settings: Settings) -> None:
    settings = mock_settings.model_copy(update={"rate_limit_per_minute": 2})
    controller = RequestController(settings=settings)
    assert await controller.allow_request("vnua", "student-1") is True
    assert await controller.allow_request("vnua", "student-1") is True
    assert await controller.allow_request("vnua", "student-1") is False


@pytest.mark.asyncio
async def test_rate_limit_is_separate_per_ip(mock_settings: Settings) -> None:
    settings = mock_settings.model_copy(update={"rate_limit_per_minute": 1})
    controller = RequestController(settings=settings)
    assert await controller.allow_request("vnua", "ip:1.1.1.1") is True
    assert await controller.allow_request("vnua", "ip:1.1.1.1") is False
    assert await controller.allow_request("vnua", "ip:2.2.2.2") is True


def test_chunked_body_limit_returns_413(client) -> None:
    response = client.post(
        "/v1/chat",
        content=b"x" * (1_048_576 + 1),
        headers={
            "Authorization": "Bearer test-secret-token-123",
            "Content-Type": "application/json",
        },
    )
    assert response.status_code == 413
    assert response.json()["error_code"] == "PAYLOAD_TOO_LARGE"


def test_trusted_headers_override_body_identity(client) -> None:
    class CapturingRunner:
        captured = None

        async def astream_events(self, request):
            self.captured = request
            yield {"event": "answer.error", "data": "{}"}

    runner = CapturingRunner()
    register_component("graph_runner", runner)
    response = client.post(
        "/v1/chat",
        json={
            "message": "Quy chế học tập",
            "request_id": "body-request",
            "tenant_id": "vnua",
            "user_id": "body-user",
        },
        headers={
            "Authorization": "Bearer test-secret-token-123",
            "X-Request-ID": "trusted-request",
            "X-Tenant-ID": "test_tenant",
            "X-User-ID": "trusted-user",
        },
    )

    assert response.status_code == 200
    assert runner.captured.request_id == "trusted-request"
    assert runner.captured.tenant_id == "test_tenant"
    assert runner.captured.user_id == "trusted-user"


def test_unknown_tenant_header_is_rejected(client) -> None:
    response = client.post(
        "/v1/chat",
        json={"message": "Quy chế học tập"},
        headers={
            "Authorization": "Bearer test-secret-token-123",
            "X-Tenant-ID": "foreign_university",
        },
    )
    assert response.status_code == 403
    assert response.json()["error_code"] == "TENANT_FORBIDDEN"
