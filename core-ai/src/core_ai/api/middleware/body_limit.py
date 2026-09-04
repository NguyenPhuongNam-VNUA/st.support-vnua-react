"""ASGI request-body limiter that also covers chunked transfer encoding."""

import json
from typing import Any, Optional

from core_ai.config import Settings, get_settings


class RequestBodyLimitMiddleware:
    def __init__(self, app: Any, settings: Optional[Settings] = None) -> None:
        self.app = app
        self.limit = (settings or get_settings()).max_request_body_bytes

    async def __call__(self, scope: dict, receive: Any, send: Any) -> None:
        if scope.get("type") != "http":
            await self.app(scope, receive, send)
            return

        body = bytearray()
        more = True
        while more:
            message = await receive()
            if message.get("type") == "http.disconnect":
                return
            body.extend(message.get("body", b""))
            if len(body) > self.limit:
                payload = json.dumps(
                    {
                        "error_code": "PAYLOAD_TOO_LARGE",
                        "message": "Request body vượt quá giới hạn cho phép",
                        "retryable": False,
                    },
                    ensure_ascii=False,
                ).encode("utf-8")
                await send(
                    {
                        "type": "http.response.start",
                        "status": 413,
                        "headers": [
                            (b"content-type", b"application/json; charset=utf-8"),
                            (b"content-length", str(len(payload)).encode("ascii")),
                        ],
                    }
                )
                await send({"type": "http.response.body", "body": payload})
                return
            more = bool(message.get("more_body", False))

        delivered = False

        async def replay() -> dict:
            nonlocal delivered
            if delivered:
                return {"type": "http.request", "body": b"", "more_body": False}
            delivered = True
            return {"type": "http.request", "body": bytes(body), "more_body": False}

        await self.app(scope, replay, send)
