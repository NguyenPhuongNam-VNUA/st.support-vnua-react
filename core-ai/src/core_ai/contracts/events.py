"""Server-Sent Events (SSE) streaming contracts for core-ai.

Defines the 5 standard SSE event payloads conforming to RFC 8895:
1. request.accepted
2. pipeline.status
3. answer.delta
4. answer.completed
5. answer.error
"""

from datetime import datetime, timezone
import json
from typing import Any, Dict, Literal, Optional, Union
from pydantic import BaseModel, Field, model_validator

from core_ai.contracts.chat import ChatResponse, FallbackInfo


def get_current_iso_timestamp() -> str:
    """Returns current UTC timestamp formatted in ISO 8601."""
    return datetime.now(timezone.utc).isoformat()


class RequestAcceptedPayload(BaseModel):
    """Immediate acknowledgment emitted upon passing input guardrail (< 100ms)."""
    request_id: str = Field(..., description="Request UUID")
    conversation_id: Optional[Union[int, str]] = Field(
        default=None,
        description="Conversation session ID",
    )
    timestamp: str = Field(default_factory=get_current_iso_timestamp)
    status: Literal["accepted"] = "accepted"


class PipelineStatusPayload(BaseModel):
    """Real-time stage progress indicator with friendly Vietnamese labels."""
    request_id: str = Field(..., description="Request UUID")
    stage: Literal[
        "input_guardrail",
        "cache_check",
        "semantic_cache",
        "retrieval",
        "rerank",
        "evidence_eval",
        "tool_execution",
        "tool_node",
        "generation",
        "fallback",
        "output_guardrail",
        "completed",
        "error",
    ] = Field(..., description="Current pipeline node identifier")
    status: Literal["in_progress", "completed", "skipped", "degraded", "passed", "failed"] = Field(
        ...,
        description="Stage status",
    )
    message: str = Field(
        ...,
        description="Safe, student-friendly status label. FORBIDDEN: chain-of-thought or 'AI đang suy nghĩ'",
        examples=["Đang kiểm tra câu hỏi", "Đang tìm kiếm tài liệu", "Đang tổng hợp thông tin", "Đang xác minh nguồn trích dẫn"],
    )
    message_vi: Optional[str] = Field(
        default=None,
        description="Vietnamese message alias",
    )
    progress_percent: Optional[int] = Field(
        default=None,
        ge=0,
        le=100,
        description="Optional progress percentage indicator",
    )
    latency_ms: Optional[int] = Field(
        default=None,
        ge=0,
        description="Latency of the finished stage in ms",
    )
    timestamp: str = Field(default_factory=get_current_iso_timestamp)

    @model_validator(mode="after")
    def sync_message_vi(self) -> "PipelineStatusPayload":
        if self.message_vi is None:
            self.message_vi = self.message
        return self


class AnswerDeltaPayload(BaseModel):
    """Incremental streaming of verified text chunks emitted after output guardrail validation."""
    request_id: str = Field(..., description="Request UUID")
    delta: str = Field(..., description="Incremental verified text fragment")
    index: int = Field(..., ge=0, description="Sequential chunk counter (0-indexed)")


class TokenUsageSummary(BaseModel):
    """Token usage and external AI call budget summary."""
    prompt_tokens: int = Field(default=0, ge=0)
    completion_tokens: int = Field(default=0, ge=0)
    total_tokens: int = Field(default=0, ge=0)
    external_calls_count: int = Field(
        default=0,
        ge=0,
        le=2,
        description="Number of external AI calls consumed (hard ceiling <= 2)",
    )


class AnswerCompletedPayload(ChatResponse):
    """Final SSE event delivering full verified response, citations, trace, and token usage."""
    usage: Optional[TokenUsageSummary] = Field(
        default=None,
        description="Aggregated token usage and call count",
    )


class AnswerErrorPayload(BaseModel):
    """Terminal SSE event signaling unrecoverable pipeline failure."""
    request_id: str = Field(..., description="Request UUID")
    code: str = Field(
        ...,
        description="Standardized domain error code",
        examples=["AUTH_FAILED", "BUDGET_EXCEEDED", "RATE_LIMITED", "GUARDRAIL_BLOCKED"],
    )
    error_code: Optional[str] = Field(
        default=None,
        description="Alias for code",
    )
    message: str = Field(
        ...,
        description="Sanitized student-facing error message (no stack traces or DB details)",
        examples=["Hệ thống trợ lý hiện đang quá tải. Vui lòng thử lại sau giây lát."],
    )
    retryable: bool = Field(
        default=False,
        description="Whether client should attempt retry",
    )
    fallback: Optional[FallbackInfo] = Field(
        default=None,
        description="Fallback contact or ticket information",
    )
    fallback_channel: Optional[str] = Field(
        default=None,
        description="Optional contact channel string",
    )
    timestamp: str = Field(default_factory=get_current_iso_timestamp)

    @model_validator(mode="after")
    def sync_error_code(self) -> "AnswerErrorPayload":
        if self.error_code is None:
            self.error_code = self.code
        return self


SSEEventPayload = Union[
    RequestAcceptedPayload,
    PipelineStatusPayload,
    AnswerDeltaPayload,
    AnswerCompletedPayload,
    AnswerErrorPayload,
    Dict[str, Any],
]


class JsonDataString(str):
    """String representation of JSON data that also allows dict subscription for compatibility."""

    def __init__(self, value: str) -> None:
        super().__init__()
        self._parsed: Optional[Any] = None

    def _get_parsed(self) -> Any:
        if self._parsed is None:
            try:
                self._parsed = json.loads(self)
            except Exception:
                self._parsed = {}
        return self._parsed

    def __getitem__(self, key: Any) -> Any:
        parsed = self._get_parsed()
        if isinstance(key, str) and isinstance(parsed, dict):
            return parsed[key]
        if isinstance(key, int) and isinstance(parsed, list):
            return parsed[key]
        return super().__getitem__(key)

    def get(self, key: str, default: Any = None) -> Any:
        parsed = self._get_parsed()
        if isinstance(parsed, dict):
            return parsed.get(key, default)
        return default

    def __contains__(self, item: Any) -> bool:
        parsed = self._get_parsed()
        if isinstance(item, str) and isinstance(parsed, dict):
            return item in parsed or super().__contains__(item)
        return super().__contains__(item)


class SSEEvent(BaseModel):
    """Unified Server-Sent Event wrapper conforming to RFC 8895 format."""
    event: Literal[
        "request.accepted",
        "pipeline.status",
        "answer.delta",
        "answer.completed",
        "answer.error",
    ] = Field(..., description="SSE event name")
    data: SSEEventPayload = Field(..., description="Payload data")
    id: Optional[str] = Field(default=None, description="SSE message identifier")
    retry: Optional[int] = Field(default=None, description="SSE reconnection timeout in ms")

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dict structure suitable for sse-starlette EventSourceResponse."""
        if isinstance(self.data, BaseModel):
            payload = self.data.model_dump(mode="json", by_alias=True)
        elif isinstance(self.data, dict):
            payload = self.data
        else:
            payload = {"value": str(self.data)}

        data_str = JsonDataString(json.dumps(payload, ensure_ascii=False))
        result: Dict[str, Any] = {
            "event": self.event,
            "data": data_str,
        }
        if self.id is not None:
            result["id"] = self.id
        if self.retry is not None:
            result["retry"] = self.retry
        return result

    def to_sse_frame(self) -> str:
        """Encodes model into standard RFC 8895 SSE wire frame."""
        if isinstance(self.data, BaseModel):
            payload_str = self.data.model_dump_json(by_alias=True)
        elif isinstance(self.data, dict):
            payload_str = json.dumps(self.data, ensure_ascii=False)
        else:
            payload_str = str(self.data)

        frame = ""
        if self.id:
            frame += f"id: {self.id}\n"
        if self.retry:
            frame += f"retry: {self.retry}\n"
        frame += f"event: {self.event}\n"
        frame += f"data: {payload_str}\n\n"
        return frame

    def to_sse_string(self) -> str:
        """Encodes event to SSE wire format string (alias for to_sse_frame)."""
        return self.to_sse_frame()
