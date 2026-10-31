"""Internal endpoints backing the admin "Cấu hình AI Agent" page."""

from __future__ import annotations

import re
import time
from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from core_ai.config import get_settings
from core_ai.dependencies import get_component, verify_internal_token

router = APIRouter(tags=["Agent Settings"], dependencies=[Depends(verify_internal_token)])

_MODEL_PATTERN = re.compile(r"^[A-Za-z0-9._:/-]{1,120}$")


@router.get("/api/v1/agent-settings/defaults")
async def get_agent_setting_defaults() -> Dict[str, Any]:
    """Environment defaults the admin page shows when a field is not overridden."""
    from core_ai.graph.nodes.generation_node import SYSTEM_PROMPT_TEMPLATE

    settings = get_settings()
    llm_port = get_component("llm_port")
    # The gateway also resolves provider-specific env keys (OPENAI_API_KEY, ...).
    active = await llm_port.get_active_model_config() if llm_port is not None else None
    return {
        "system_prompt": SYSTEM_PROMPT_TEMPLATE,
        "llm_provider": settings.llm_provider,
        "llm_model": settings.llm_model,
        "temperature": settings.llm_temperature,
        "evidence_low_threshold": settings.evidence_low_threshold,
        "evidence_high_threshold": settings.evidence_high_threshold,
        "embedding_model": settings.embedding_model,
        "api_key_configured": bool(active and active.api_key),
    }


class ModelTestRequest(BaseModel):
    model: str = Field(..., min_length=1, max_length=120)


@router.post("/api/v1/agent-settings/test-model")
async def test_model(body: ModelTestRequest) -> Dict[str, Any]:
    """Send one tiny prompt to the given model with the server's provider and key."""
    if not _MODEL_PATTERN.match(body.model):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Tên model không hợp lệ")
    llm_port = get_component("llm_port")
    if llm_port is None or not hasattr(llm_port, "get_active_model_config"):
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "LLM gateway chưa sẵn sàng")

    from core_ai.contracts.llm import ChatMessage, GenerationRequest
    from core_ai.llm.litellm_adapter import LiteLLMAdapter, get_provider_capabilities

    active = await llm_port.get_active_model_config()
    config = active.model_copy(
        update={
            "model": body.model,
            "capabilities": get_provider_capabilities(active.provider, body.model),
        }
    )
    request = GenerationRequest(
        request_id="agent-settings-test",
        messages=[ChatMessage(role="user", content="Trả lời đúng một từ: OK")],
        temperature=0.0,
        max_tokens=10,
    )
    started = time.perf_counter()
    try:
        await LiteLLMAdapter().execute(config, request)
    except Exception as exc:
        return {"ok": False, "provider": active.provider, "model": body.model, "error": str(exc)[:300]}
    return {
        "ok": True,
        "provider": active.provider,
        "model": body.model,
        "latency_ms": int((time.perf_counter() - started) * 1000),
    }
