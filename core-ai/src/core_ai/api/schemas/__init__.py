"""API Schemas package.

Re-exports core contracts and provides HTTP API payload schemas.
"""

from core_ai.contracts.chat import (
    ChatRequest,
    ChatResponse,
    Citation,
    DocumentEmbedRequest,
    DocumentEmbedResponse,
    ExecutionTraceStep,
    FallbackInfo,
    LegacyAskAiRequest,
    RouteStatus,
)
from core_ai.contracts.events import (
    AnswerCompletedPayload,
    AnswerDeltaPayload,
    AnswerErrorPayload,
    PipelineStatusPayload,
    RequestAcceptedPayload,
    SSEEvent,
)

__all__ = [
    "ChatRequest",
    "ChatResponse",
    "Citation",
    "ExecutionTraceStep",
    "FallbackInfo",
    "LegacyAskAiRequest",
    "RouteStatus",
    "DocumentEmbedRequest",
    "DocumentEmbedResponse",
    "RequestAcceptedPayload",
    "PipelineStatusPayload",
    "AnswerDeltaPayload",
    "AnswerCompletedPayload",
    "AnswerErrorPayload",
    "SSEEvent",
]
