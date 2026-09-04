"""Strict adapter for authoritative student/business data owned by the Node service."""

from typing import Any, Dict, Optional

import httpx

from core_ai.config import Settings, get_settings
from core_ai.contracts.errors import ToolExecutionError
from core_ai.dependencies import get_component


async def call_business_api(
    method: str,
    path: str,
    *,
    tenant_id: str,
    user_id: str,
    request_id: Optional[str] = None,
    settings: Optional[Settings] = None,
    payload: Optional[Dict[str, Any]] = None,
    query: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Call the configured internal API and fail closed when it is unavailable."""
    settings = settings or get_component("settings") or get_settings()
    if not settings.business_api_base_url or not settings.business_api_token:
        raise ToolExecutionError("API nghiệp vụ nội bộ chưa được cấu hình")

    headers = {
        "Authorization": f"Bearer {settings.business_api_token}",
        "X-Tenant-ID": tenant_id,
        "X-User-ID": user_id,
        "Accept": "application/json",
    }
    if request_id:
        headers["X-Request-ID"] = request_id
        headers["Idempotency-Key"] = request_id
    try:
        async with httpx.AsyncClient(
            base_url=settings.business_api_base_url.rstrip("/"),
            timeout=settings.business_api_timeout_seconds,
        ) as client:
            response = await client.request(
                method,
                path,
                headers=headers,
                json=payload,
                params=query,
            )
            response.raise_for_status()
            data = response.json()
    except httpx.TimeoutException as exc:
        raise ToolExecutionError("API nghiệp vụ phản hồi quá thời gian cho phép") from exc
    except (httpx.HTTPError, ValueError) as exc:
        raise ToolExecutionError("Không thể lấy dữ liệu xác thực từ API nghiệp vụ") from exc

    if not isinstance(data, dict):
        raise ToolExecutionError("API nghiệp vụ trả về dữ liệu không hợp lệ")
    return data
