"""Domain error codes and typed exception hierarchy for ST-Care Core AI.

All errors raised within core-ai map to standardized machine-readable codes,
HTTP status codes, and user-friendly Vietnamese messages.
"""

from enum import Enum
from typing import Any, Dict, Optional


class ErrorCode(str, Enum):
    # Authentication & Tenant Security
    AUTH_FAILED = "AUTH_FAILED"
    FORBIDDEN = "FORBIDDEN"
    TENANT_FORBIDDEN = "TENANT_FORBIDDEN"

    # Rate Limiting & Quotas
    RATE_LIMITED = "RATE_LIMITED"
    BUDGET_EXCEEDED = "BUDGET_EXCEEDED"

    # Payload & Guardrails
    INVALID_PAYLOAD = "INVALID_PAYLOAD"
    GUARDRAIL_BLOCKED = "GUARDRAIL_BLOCKED"
    PAYLOAD_TOO_LARGE = "PAYLOAD_TOO_LARGE"

    # Data & Retrieval Failures
    RETRIEVAL_FAILED = "RETRIEVAL_FAILED"
    DATABASE_UNAVAILABLE = "DATABASE_UNAVAILABLE"

    # LLM Provider Failures
    PROVIDER_TIMEOUT = "PROVIDER_TIMEOUT"
    PROVIDER_UNAVAILABLE = "PROVIDER_UNAVAILABLE"
    MALFORMED_OUTPUT = "MALFORMED_OUTPUT"

    # MCP Tool Failures
    TOOL_EXECUTION_FAILED = "TOOL_EXECUTION_FAILED"
    CIRCUIT_BREAKER_OPEN = "CIRCUIT_BREAKER_OPEN"
    TOOL_NOT_ALLOWED = "TOOL_NOT_ALLOWED"

    # Internal Failures
    INTERNAL_ERROR = "INTERNAL_ERROR"
    DUPLICATE_REQUEST = "DUPLICATE_REQUEST"


class CoreAIError(Exception):
    """Base exception for all domain errors in core-ai."""

    def __init__(
        self,
        message: str,
        code: ErrorCode = ErrorCode.INTERNAL_ERROR,
        status_code: int = 500,
        retryable: bool = False,
        details: Optional[Dict[str, Any]] = None,
    ) -> None:
        super().__init__(message)
        self.message = message
        self.code = code
        self.status_code = status_code
        self.retryable = retryable
        self.details = details or {}

    def to_dict(self) -> Dict[str, Any]:
        result: Dict[str, Any] = {
            "error_code": self.code.value,
            "message": self.message,
            "retryable": self.retryable,
        }
        if self.details:
            result["details"] = self.details
        return result


class AuthenticationError(CoreAIError):
    def __init__(self, message: str = "Xác thực token nội bộ không hợp lệ") -> None:
        super().__init__(
            message=message,
            code=ErrorCode.AUTH_FAILED,
            status_code=401,
            retryable=False,
        )


class ForbiddenError(CoreAIError):
    def __init__(self, message: str = "Không có quyền thực hiện yêu cầu này") -> None:
        super().__init__(
            message=message,
            code=ErrorCode.FORBIDDEN,
            status_code=403,
            retryable=False,
        )


class TenantForbiddenError(CoreAIError):
    def __init__(self, message: str = "Không có quyền truy cập dữ liệu của tenant") -> None:
        super().__init__(
            message=message,
            code=ErrorCode.TENANT_FORBIDDEN,
            status_code=403,
            retryable=False,
        )


class RateLimitExceededError(CoreAIError):
    def __init__(self, message: str = "Hệ thống đang bận. Vui lòng thử lại sau giây lát") -> None:
        super().__init__(
            message=message,
            code=ErrorCode.RATE_LIMITED,
            status_code=429,
            retryable=True,
        )


class DuplicateRequestError(CoreAIError):
    def __init__(self, message: str = "Yêu cầu có mã request_id này đang hoặc đã được xử lý") -> None:
        super().__init__(
            message=message,
            code=ErrorCode.DUPLICATE_REQUEST,
            status_code=409,
            retryable=False,
        )


class CallBudgetExceededError(CoreAIError):
    def __init__(self, message: str = "Vượt quá giới hạn cuộc gọi AI bên ngoài (tối đa 2 calls)") -> None:
        super().__init__(
            message=message,
            code=ErrorCode.BUDGET_EXCEEDED,
            status_code=429,
            retryable=False,
        )


class InvalidPayloadError(CoreAIError):
    def __init__(self, message: str = "Dữ liệu yêu cầu không hợp lệ") -> None:
        super().__init__(
            message=message,
            code=ErrorCode.INVALID_PAYLOAD,
            status_code=422,
            retryable=False,
        )


class PayloadTooLargeError(CoreAIError):
    def __init__(self, message: str = "Câu hỏi vượt quá giới hạn 4000 ký tự") -> None:
        super().__init__(
            message=message,
            code=ErrorCode.PAYLOAD_TOO_LARGE,
            status_code=413,
            retryable=False,
        )


class GuardrailBlockedError(CoreAIError):
    def __init__(self, message: str = "Yêu cầu bị chặn do vi phạm chính sách an toàn thông tin") -> None:
        super().__init__(
            message=message,
            code=ErrorCode.GUARDRAIL_BLOCKED,
            status_code=400,
            retryable=False,
        )


class RetrievalError(CoreAIError):
    def __init__(self, message: str = "Không thể truy vấn cơ sở dữ liệu tri thức") -> None:
        super().__init__(
            message=message,
            code=ErrorCode.RETRIEVAL_FAILED,
            status_code=502,
            retryable=True,
        )


class DatabaseUnavailableError(CoreAIError):
    def __init__(self, message: str = "Kết nối cơ sở dữ liệu tạm thời không khả dụng") -> None:
        super().__init__(
            message=message,
            code=ErrorCode.DATABASE_UNAVAILABLE,
            status_code=503,
            retryable=True,
        )


class ProviderTimeoutError(CoreAIError):
    def __init__(self, message: str = "Nhà cung cấp mô hình AI phản hồi quá thời gian cho phép") -> None:
        super().__init__(
            message=message,
            code=ErrorCode.PROVIDER_TIMEOUT,
            status_code=504,
            retryable=True,
        )


class ProviderUnavailableError(CoreAIError):
    def __init__(self, message: str = "Dịch vụ mô hình AI hiện không khả dụng") -> None:
        super().__init__(
            message=message,
            code=ErrorCode.PROVIDER_UNAVAILABLE,
            status_code=503,
            retryable=True,
        )


class MalformedOutputError(CoreAIError):
    def __init__(
        self,
        message: str = "Đầu ra từ mô hình không đúng định dạng và không thể sửa chữa cục bộ",
        details: Optional[Dict[str, Any]] = None,
    ) -> None:
        super().__init__(
            message=message,
            code=ErrorCode.MALFORMED_OUTPUT,
            status_code=502,
            retryable=False,
            details=details,
        )


class ToolExecutionError(CoreAIError):
    def __init__(self, message: str = "Lỗi khi thực thi công cụ MCP") -> None:
        super().__init__(
            message=message,
            code=ErrorCode.TOOL_EXECUTION_FAILED,
            status_code=502,
            retryable=True,
        )


class CircuitBreakerOpenError(CoreAIError):
    def __init__(self, tool_name: str) -> None:
        super().__init__(
            message=f"Công cụ {tool_name} tạm thời ngừng hoạt động do lỗi liên tiếp",
            code=ErrorCode.CIRCUIT_BREAKER_OPEN,
            status_code=503,
            retryable=True,
            details={"tool_name": tool_name},
        )


class ToolNotAllowedError(CoreAIError):
    def __init__(self, tool_name: str) -> None:
        super().__init__(
            message=f"Công cụ {tool_name} không được phép sử dụng hoặc nằm ngoài phạm vi phân quyền",
            code=ErrorCode.TOOL_NOT_ALLOWED,
            status_code=403,
            retryable=False,
            details={"tool_name": tool_name},
        )
