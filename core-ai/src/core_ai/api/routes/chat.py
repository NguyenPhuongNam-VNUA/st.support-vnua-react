"""Authenticated chat endpoints backed exclusively by the LangGraph runner."""

import json
from typing import Any, AsyncGenerator, Dict, Optional

from fastapi import APIRouter, Depends, Request, status
from sse_starlette.sse import EventSourceResponse

from core_ai.contracts.chat import ChatRequest, FallbackInfo, LegacyAskAiRequest
from core_ai.contracts.errors import DuplicateRequestError, ErrorCode, RateLimitExceededError
from core_ai.contracts.events import AnswerErrorPayload, SSEEvent
from core_ai.data.request_control import get_request_controller
from core_ai.dependencies import get_component, verify_internal_token

router = APIRouter(tags=["Chat"])


async def stream_chat_pipeline(chat_request: ChatRequest) -> AsyncGenerator[Dict[str, Any], None]:
    """Stream the real orchestration graph; never synthesize placeholder answers."""
    graph_runner = get_component("graph_runner")
    if graph_runner is not None and hasattr(graph_runner, "astream_events"):
        async for event in graph_runner.astream_events(chat_request):
            yield event
        return

    error = AnswerErrorPayload(
        request_id=chat_request.request_id or "unavailable",
        code=ErrorCode.INTERNAL_ERROR.value,
        error_code=ErrorCode.INTERNAL_ERROR.value,
        message="Bộ điều phối AI chưa sẵn sàng. Vui lòng thử lại sau.",
        retryable=True,
        fallback=FallbackInfo(
            reason="graph_runner_unavailable",
            fallback_strategy="safe_template",
            contact_channel="Ban Quản lý Đào tạo VNUA: phongdaotao@vnua.edu.vn",
        ),
    )
    yield SSEEvent(event="answer.error", data=error).to_dict()


@router.post(
    "/v1/chat",
    summary="Chat Streaming Endpoint (SSE)",
    response_class=EventSourceResponse,
    dependencies=[Depends(verify_internal_token)],
)
async def chat_streaming(request: Request, chat_request: ChatRequest) -> EventSourceResponse:
    """Use only identity established by authenticated proxy headers."""
    context = request.state.context
    controller = get_request_controller(request.app.state.settings)
    if not await controller.allow_request(context.tenant_id, context.user_id):
        raise RateLimitExceededError()
    if not await controller.claim_request(context.tenant_id, context.request_id):
        raise DuplicateRequestError()
    trusted_request = chat_request.model_copy(
        update={
            "request_id": context.request_id,
            "tenant_id": context.tenant_id,
            "user_id": context.user_id,
        }
    )
    return EventSourceResponse(
        stream_chat_pipeline(trusted_request),
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post(
    "/ask-ai",
    summary="Legacy Chat JSON Endpoint",
    response_model=Dict[str, Any],
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(verify_internal_token)],
)
async def ask_ai_legacy(request: Request, legacy_request: LegacyAskAiRequest) -> Dict[str, Any]:
    """Translate the legacy request into the same trusted graph pipeline."""
    context = request.state.context
    controller = get_request_controller(request.app.state.settings)
    if not await controller.allow_request(context.tenant_id, context.user_id):
        raise RateLimitExceededError()
    if not await controller.claim_request(context.tenant_id, context.request_id):
        raise DuplicateRequestError()
    chat_request = ChatRequest(
        message=legacy_request.question,
        conversation_id=legacy_request.conversation_id,
        request_id=context.request_id,
        tenant_id=context.tenant_id,
        user_id=context.user_id,
        history=[
            {"role": item.role, "content": item.content or item.text or ""}
            for item in (legacy_request.messages or [])[-6:]
            if (item.content or item.text)
        ],
    )

    completed: Optional[Dict[str, Any]] = None
    async for event in stream_chat_pipeline(chat_request):
        payload = event.get("data", {})
        data = json.loads(payload) if isinstance(payload, str) else payload
        if event.get("event") == "answer.completed":
            completed = data
        elif event.get("event") == "answer.error":
            return {
                "answer": data.get("message", "Hệ thống đang gặp sự cố."),
                "status": "degraded",
                "conversation_id": legacy_request.conversation_id,
                "sources": [],
            }

    if completed is None:
        return {
            "answer": "Không thể tạo câu trả lời vào lúc này.",
            "status": "degraded",
            "conversation_id": legacy_request.conversation_id,
            "sources": [],
        }

    return {
        "answer": completed.get("answer", ""),
        "status": completed.get("status", "degraded"),
        "conversation_id": completed.get("conversation_id"),
        "sources": [
            {
                "document_id": citation.get("document_id"),
                "title": citation.get("title"),
                "page": citation.get("page"),
                "snippet": citation.get("snippet"),
            }
            for citation in completed.get("citations", [])
        ],
    }
