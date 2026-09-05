"""Request Context Middleware and ContextVar tracking.

Captures request_id, tenant_id, and user_id from incoming HTTP headers and propagates
them through asynchronous ContextVars for structured logging and pipeline execution.
"""

import re
import time
import uuid
from contextvars import ContextVar
from dataclasses import dataclass
from typing import Any, Callable, Optional, Union

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from core_ai.config import Settings, get_settings

# ContextVars for async task propagation
request_id_ctx: ContextVar[str] = ContextVar("request_id_ctx", default="")
tenant_id_ctx: ContextVar[str] = ContextVar("tenant_id_ctx", default="vnua")
user_id_ctx: ContextVar[Optional[Union[int, str]]] = ContextVar("user_id_ctx", default=None)


@dataclass
class RequestContext:
    """Strongly-typed request context container."""
    request_id: str
    tenant_id: str
    user_id: Optional[Union[int, str]] = None
    start_time: float = 0.0


class RequestContextMiddleware(BaseHTTPMiddleware):
    """Middleware extracting context headers and attaching them to state & contextvars."""

    def __init__(self, app, settings: Optional[Settings] = None) -> None:
        super().__init__(app)
        self.settings = settings or get_settings()

    async def dispatch(self, request: Request, call_next: Any) -> Response:
        settings = self.settings

        # 1. Extract or generate Request ID
        req_id = (request.headers.get("X-Request-ID") or str(uuid.uuid4())).strip()
        if len(req_id) > 64 or not re.fullmatch(r"[A-Za-z0-9._:-]+", req_id):
            return JSONResponse(
                status_code=400,
                content={
                    "error_code": "INVALID_PAYLOAD",
                    "message": "X-Request-ID không hợp lệ",
                    "retryable": False,
                },
            )

        # 2. Extract or default Tenant ID
        tenant_id = request.headers.get("X-Tenant-ID") or settings.default_tenant
        allowed_tenants = settings.allowed_tenants
        if isinstance(allowed_tenants, str):
            allowed_tenants = [item.strip() for item in allowed_tenants.split(",") if item.strip()]
        if tenant_id not in allowed_tenants:
            return JSONResponse(
                status_code=403,
                content={
                    "error_code": "TENANT_FORBIDDEN",
                    "message": "Tenant không được phép truy cập dịch vụ",
                    "retryable": False,
                },
            )

        # 3. Extract optional User ID
        raw_user_id = request.headers.get("X-User-ID")
        user_id: Optional[Union[int, str]] = None
        if raw_user_id:
            raw_user_id = raw_user_id.strip()
            if len(raw_user_id) > 128 or not re.fullmatch(r"[A-Za-z0-9_.:@-]+", raw_user_id):
                return JSONResponse(
                    status_code=400,
                    content={
                        "error_code": "INVALID_PAYLOAD",
                        "message": "X-User-ID không hợp lệ",
                        "retryable": False,
                    },
                )
            if raw_user_id.isdigit():
                user_id = int(raw_user_id)
            elif raw_user_id:
                user_id = raw_user_id

        # 4. Bind to ContextVars
        token_req = request_id_ctx.set(req_id)
        token_tenant = tenant_id_ctx.set(tenant_id)
        token_user = user_id_ctx.set(user_id)

        start_time = time.perf_counter()

        # 5. Attach to request.state for route dependency access
        context = RequestContext(
            request_id=req_id,
            tenant_id=tenant_id,
            user_id=user_id,
            start_time=start_time,
        )
        request.state.context = context
        request.state.request_id = req_id
        request.state.tenant_id = tenant_id
        request.state.user_id = user_id

        try:
            response = await call_next(request)
            # Propagate Request ID back to client
            response.headers["X-Request-ID"] = req_id
            return response
        finally:
            request_id_ctx.reset(token_req)
            tenant_id_ctx.reset(token_tenant)
            user_id_ctx.reset(token_user)
