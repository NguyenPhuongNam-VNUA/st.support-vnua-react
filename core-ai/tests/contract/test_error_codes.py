"""Contract Tests for Standardized Error Codes and Exception Hierarchy.

Verifies:
1. Complete ErrorCode enumeration across all error categories.
2. Standard HTTP status code mappings.
3. Retryable flags for transient versus permanent failures.
4. Serialized error payload structure via to_dict().
"""

import pytest

from core_ai.contracts.errors import (
    AuthenticationError,
    CallBudgetExceededError,
    CircuitBreakerOpenError,
    CoreAIError,
    DatabaseUnavailableError,
    ErrorCode,
    ForbiddenError,
    GuardrailBlockedError,
    InvalidPayloadError,
    MalformedOutputError,
    PayloadTooLargeError,
    ProviderTimeoutError,
    ProviderUnavailableError,
    RateLimitExceededError,
    RetrievalError,
    TenantForbiddenError,
    ToolExecutionError,
    ToolNotAllowedError,
)


class TestErrorCodesContract:
    def test_all_expected_error_codes_present(self) -> None:
        """Verifies presence of all standardized error codes defined in the architecture plan."""
        expected = {
            "AUTH_FAILED",
            "FORBIDDEN",
            "TENANT_FORBIDDEN",
            "RATE_LIMITED",
            "BUDGET_EXCEEDED",
            "INVALID_PAYLOAD",
            "GUARDRAIL_BLOCKED",
            "PAYLOAD_TOO_LARGE",
            "RETRIEVAL_FAILED",
            "DATABASE_UNAVAILABLE",
            "PROVIDER_TIMEOUT",
            "PROVIDER_UNAVAILABLE",
            "MALFORMED_OUTPUT",
            "TOOL_EXECUTION_FAILED",
            "CIRCUIT_BREAKER_OPEN",
            "TOOL_NOT_ALLOWED",
            "INTERNAL_ERROR",
        }
        actual = {e.value for e in ErrorCode}
        assert expected.issubset(actual)

    def test_exception_status_codes_and_retryability(self) -> None:
        """Verifies HTTP status codes and retryability flags for core domain exceptions."""
        cases = [
            (AuthenticationError(), 401, False, ErrorCode.AUTH_FAILED),
            (ForbiddenError(), 403, False, ErrorCode.FORBIDDEN),
            (TenantForbiddenError(), 403, False, ErrorCode.TENANT_FORBIDDEN),
            (RateLimitExceededError(), 429, True, ErrorCode.RATE_LIMITED),
            (CallBudgetExceededError(), 429, False, ErrorCode.BUDGET_EXCEEDED),
            (InvalidPayloadError(), 422, False, ErrorCode.INVALID_PAYLOAD),
            (PayloadTooLargeError(), 413, False, ErrorCode.PAYLOAD_TOO_LARGE),
            (GuardrailBlockedError(), 400, False, ErrorCode.GUARDRAIL_BLOCKED),
            (RetrievalError(), 502, True, ErrorCode.RETRIEVAL_FAILED),
            (DatabaseUnavailableError(), 503, True, ErrorCode.DATABASE_UNAVAILABLE),
            (ProviderTimeoutError(), 504, True, ErrorCode.PROVIDER_TIMEOUT),
            (ProviderUnavailableError(), 503, True, ErrorCode.PROVIDER_UNAVAILABLE),
            (MalformedOutputError(), 502, False, ErrorCode.MALFORMED_OUTPUT),
            (CircuitBreakerOpenError(tool_name="test_tool"), 503, True, ErrorCode.CIRCUIT_BREAKER_OPEN),
            (ToolNotAllowedError(tool_name="restricted_tool"), 403, False, ErrorCode.TOOL_NOT_ALLOWED),
        ]

        for exc, expected_status, expected_retryable, expected_code in cases:
            assert exc.status_code == expected_status, f"{exc.__class__.__name__} status code mismatch"
            assert exc.retryable == expected_retryable, f"{exc.__class__.__name__} retryable mismatch"
            assert exc.code == expected_code, f"{exc.__class__.__name__} code mismatch"

    def test_to_dict_serialization(self) -> None:
        """Verifies structure of exception serialized dictionary."""
        exc = CircuitBreakerOpenError(tool_name="lookup_schedule")
        d = exc.to_dict()

        assert d["error_code"] == "CIRCUIT_BREAKER_OPEN"
        assert d["retryable"] is True
        assert "lookup_schedule" in d["message"]
        assert d["details"] == {"tool_name": "lookup_schedule"}
