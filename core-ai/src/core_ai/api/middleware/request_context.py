"""Request Context Middleware and ContextVar tracking.

Captures request_id, tenant_id, and user_id from incoming HTTP headers and propagates
them through asynchronous ContextVars for structured logging and pipeline execution.
"""

from contextvars import ContextVar
from dataclasses import dataclass
import time
from typing import Callable, Optional, Union
import uuid

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

from core_ai.config import get_settings


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

    async def dispatch(self, request: Request, call_next: Callable[[Request], Response]) -> Response:
        settings = get_settings()

        # 1. Extract or generate Request ID
        req_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
        
        # 2. Extract or default Tenant ID
        tenant_id = request.headers.get("X-Tenant-ID") or settings.default_tenant
        
        # 3. Extract optional User ID
        raw_user_id = request.headers.get("X-User-ID")
        user_id: Optional[Union[int, str]] = None
        if raw_user_id:
            raw_user_id = raw_user_id.strip()
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
