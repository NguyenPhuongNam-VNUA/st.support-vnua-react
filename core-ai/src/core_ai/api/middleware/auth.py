"""Authentication middleware and token verification.

Enforces Bearer token authentication against INTERNAL_SERVICE_TOKEN or AI_AGENT_SERVICE_TOKEN
for inter-service calls between Node.js BFF and core-ai.
"""

import hmac
import json
from typing import Callable, Set

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from core_ai.config import get_settings
from core_ai.contracts.errors import AuthenticationError, ErrorCode


EXEMPT_PATHS: Set[str] = {
    "/health",
    "/health/live",
    "/health/ready",
    "/docs",
    "/redoc",
    "/openapi.json",
}


def is_path_exempt(path: str) -> bool:
    """Checks whether the requested URL path is exempt from token verification."""
    clean_path = path.rstrip("/")
    if not clean_path:
        clean_path = "/"
    if clean_path in EXEMPT_PATHS or path in EXEMPT_PATHS:
        return True
    # Exempt subpaths under /health
    if clean_path.startswith("/health/"):
        return True
    return False


def validate_token(token: str, expected_token: str) -> bool:
    """Constant-time token validation against timing attacks."""
    if not token or not expected_token:
        return False
    return hmac.compare_digest(token.strip().encode("utf-8"), expected_token.strip().encode("utf-8"))


class InternalAuthMiddleware(BaseHTTPMiddleware):
    """Middleware enforcing Bearer internal service token on non-exempt routes."""

    async def dispatch(self, request: Request, call_next: Callable[[Request], Response]) -> Response:
        if is_path_exempt(request.url.path):
            return await call_next(request)

        settings = get_settings()
        expected_token = settings.internal_service_token

        # If running in development and no token configured, permit request with warning
        if not expected_token and settings.app_env.lower() == "development":
            return await call_next(request)

        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return JSONResponse(
                status_code=401,
                content={
                    "error_code": ErrorCode.AUTH_FAILED.value,
                    "message": "Thiếu Authorization header dạng Bearer token",
                    "retryable": False,
                },
            )

        provided_token = auth_header[7:].strip()
        if not validate_token(provided_token, expected_token):
            return JSONResponse(
                status_code=401,
                content={
                    "error_code": ErrorCode.AUTH_FAILED.value,
                    "message": "Token dịch vụ nội bộ không chính xác",
                    "retryable": False,
                },
            )

        return await call_next(request)
