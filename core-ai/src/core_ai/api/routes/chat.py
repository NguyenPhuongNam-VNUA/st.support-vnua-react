"""Authenticated legacy chat endpoints.

Maintains backward compatibility for existing Next.js BFF:
- POST /v1/chat (SSE streaming)
- POST /ask-ai (Legacy synchronous JSON)

Delegates all pipeline execution to the unified dispatchers in conversations router.
"""

import json
from typing import Any, Dict

from fastapi import APIRouter, Depends, Request, status
from sse_starlette.sse import EventSourceResponse

from core_ai.api.routes.conversations import (
    dispatch_chat_json,
    dispatch_chat_stream,
)
from core_ai.contracts.chat import ChatRequest, LegacyAskAiRequest
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


@router.post(
    "/ask-ai",
    summary="Legacy Chat JSON Endpoint",
    response_model=Dict[str, Any],
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(verify_internal_token)],
)
async def ask_ai_legacy(request: Request, legacy_request: LegacyAskAiRequest) -> Dict[str, Any]:
    """Translate legacy request payload and delegate to unified JSON dispatcher."""
    chat_request = ChatRequest(
        message=legacy_request.question,
        conversation_id=legacy_request.conversation_id,
        history=[
            {"role": item.role, "content": item.content or item.text or ""}
            for item in (legacy_request.messages or [])[-6:]
            if (item.content or item.text)
        ],
    )
    json_resp = await dispatch_chat_json(
        request, chat_request, success_status=status.HTTP_200_OK
    )
    data = json.loads(json_resp.body.decode("utf-8")) if hasattr(json_resp, "body") else {}

    # Ensure legacy schema keys
    sources = data.get("sources")
    if sources is None:
        sources = [
            {
                "document_id": c.get("document_id"),
                "title": c.get("title"),
                "page": c.get("page"),
                "snippet": c.get("snippet"),
            }
            for c in data.get("citations", [])
        ]

    return {
        "answer": data.get("answer", ""),
        "status": data.get("status", "degraded"),
        "conversation_id": legacy_request.conversation_id or data.get("conversation_id"),
        "sources": sources,
    }
