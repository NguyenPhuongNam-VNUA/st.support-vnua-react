"""Authenticated legacy chat streaming endpoint.

Delegates pipeline execution to the unified SSE dispatcher in conversations router.
"""

from fastapi import APIRouter, Depends, Request
from sse_starlette.sse import EventSourceResponse

from core_ai.api.routes.conversations import dispatch_chat_stream
from core_ai.contracts.chat import ChatRequest
from core_ai.dependencies import verify_internal_token

router = APIRouter(tags=["Chat (Legacy)"])


@router.post(
    "/v1/chat",
    summary="Chat Streaming Endpoint (Legacy SSE)",
    response_class=EventSourceResponse,
    dependencies=[Depends(verify_internal_token)],
)
async def chat_streaming(request: Request, chat_request: ChatRequest) -> EventSourceResponse:
    """Legacy alias endpoint delegating directly to unified SSE dispatcher."""
    return await dispatch_chat_stream(request, chat_request)
