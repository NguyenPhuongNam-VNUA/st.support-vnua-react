"""RESTful Conversations and Messages API endpoints.

Conforms to standard RESTful resource-oriented principles:
- POST /api/v1/conversations/{conversation_id}/messages (Content Negotiation: SSE or JSON 201 Created)
- GET  /api/v1/conversations/{conversation_id}/messages (Retrieve message history 200 OK)
- DELETE /api/v1/conversations/{conversation_id} (Remove conversation and clear memory 204 No Content)
"""

import json
from typing import Any, AsyncGenerator, Dict, Optional

from fastapi import APIRouter, Depends, Query, Request, Response, status
from fastapi.responses import JSONResponse
from sse_starlette.sse import EventSourceResponse

from core_ai.contracts.chat import ChatRequest, FallbackInfo
from core_ai.contracts.errors import (
    DuplicateRequestError,
    ErrorCode,
    RateLimitExceededError,
)
from core_ai.contracts.events import AnswerErrorPayload, SSEEvent
from core_ai.data.repositories.message_repo import get_message_repository
from core_ai.data.request_control import get_request_controller
from core_ai.dependencies import get_component, verify_internal_token

router = APIRouter(prefix="/api/v1/conversations", tags=["Conversations"])


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


async def prepare_trusted_request(request: Request, chat_request: ChatRequest) -> ChatRequest:
    """Validate request limits and bind proxy-authenticated identity context."""
    context = request.state.context
    controller = get_request_controller(request.app.state.settings)
    if not await controller.allow_request(context.tenant_id, context.user_id):
        raise RateLimitExceededError()
    if not await controller.claim_request(context.tenant_id, context.request_id):
        raise DuplicateRequestError()

    raw_ip = (
        chat_request.client_ip
        or request.headers.get("x-forwarded-for")
        or request.headers.get("x-real-ip")
        or (request.client.host if request.client else "127.0.0.1")
    )
    client_ip = raw_ip.split(",")[0].strip() if raw_ip else "127.0.0.1"

    return chat_request.model_copy(
        update={
            "request_id": context.request_id,
            "tenant_id": context.tenant_id,
            "user_id": context.user_id,
            "client_ip": client_ip,
        }
    )


async def dispatch_chat_stream(request: Request, chat_request: ChatRequest) -> EventSourceResponse:
    """Execute streaming SSE chat pipeline."""
    trusted = await prepare_trusted_request(request, chat_request)
    return EventSourceResponse(
        stream_chat_pipeline(trusted),
        status_code=status.HTTP_200_OK,
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
            "X-Request-ID": request.state.context.request_id,
        },
    )


async def dispatch_chat_json(
    request: Request,
    chat_request: ChatRequest,
    success_status: int = status.HTTP_201_CREATED,
    location_header: Optional[str] = None,
) -> JSONResponse:
    """Execute chat pipeline and await complete aggregated response."""
    trusted = await prepare_trusted_request(request, chat_request)
    conv_id = trusted.conversation_id

    completed: Optional[Dict[str, Any]] = None
    error_data: Optional[Dict[str, Any]] = None

    async for event in stream_chat_pipeline(trusted):
        payload = event.get("data", {})
        data = json.loads(payload) if isinstance(payload, str) else payload
        if event.get("event") == "answer.completed":
            completed = data
        elif event.get("event") == "answer.error":
            error_data = data

    if error_data:
        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content={
                "answer": error_data.get("message", "Hệ thống đang gặp sự cố."),
                "status": "degraded",
                "conversation_id": conv_id,
                "sources": [],
            },
        )

    if completed is None:
        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content={
                "answer": "Không thể tạo câu trả lời vào lúc này.",
                "status": "degraded",
                "conversation_id": conv_id,
                "sources": [],
            },
        )

    headers: Dict[str, str] = {"X-Request-ID": request.state.context.request_id}
    if location_header:
        headers["Location"] = location_header

    return JSONResponse(
        status_code=success_status,
        content=completed,
        headers=headers,
    )


# ==========================================
# RESTful API Endpoints
# ==========================================


@router.post(
    "/{conversation_id}/messages",
    summary="Create message in conversation (RESTful)",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(verify_internal_token)],
)
async def create_conversation_message(
    conversation_id: str,
    request: Request,
    chat_request: ChatRequest,
) -> Any:
    """Send a message to the AI within a conversation resource.

    Supports Content Negotiation:
    - Accept: text/event-stream -> Returns EventSourceResponse streaming tokens (200 OK)
    - Accept: application/json (default) -> Returns complete ChatResponse with HTTP 201 Created
    """
    chat_request = chat_request.model_copy(update={"conversation_id": conversation_id})
    accept_header = request.headers.get("accept", "").lower()

    if "text/event-stream" in accept_header:
        return await dispatch_chat_stream(request, chat_request)

    return await dispatch_chat_json(
        request,
        chat_request,
        success_status=status.HTTP_201_CREATED,
        location_header=f"/api/v1/conversations/{conversation_id}/messages",
    )


@router.get(
    "/{conversation_id}/messages",
    summary="Get conversation message history (RESTful)",
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(verify_internal_token)],
)
async def get_conversation_messages(
    conversation_id: str,
    limit: int = Query(default=50, ge=1, le=100, description="Max messages to retrieve"),
) -> Dict[str, Any]:
    """Retrieve chronologically ordered messages in this conversation."""
    repo = get_message_repository()
    messages = await repo.get_messages_by_conversation(conversation_id, limit=limit)
    return {
        "conversation_id": conversation_id,
        "count": len(messages),
        "messages": messages,
    }


@router.delete(
    "/{conversation_id}",
    summary="Delete conversation session (RESTful)",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(verify_internal_token)],
)
async def delete_conversation(conversation_id: str) -> Response:
    """Delete all messages, conversation record, and clear in-memory session cache."""
    repo = get_message_repository()
    await repo.delete_conversation(conversation_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
