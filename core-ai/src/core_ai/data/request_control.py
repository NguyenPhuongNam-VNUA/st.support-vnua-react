"""Redis-backed idempotency and rate limits with a bounded local fallback."""

import asyncio
import hashlib
import time
from collections import OrderedDict
from typing import Optional, Union

from core_ai.config import Settings, get_settings
from core_ai.data.redis import get_redis_client


class RequestController:
    """Protect chat endpoints without making Redis a hard dependency."""

    def __init__(self, settings: Optional[Settings] = None, max_local_keys: int = 10_000) -> None:
        self.settings = settings or get_settings()
        self.max_local_keys = max_local_keys
        self._lock = asyncio.Lock()
        self._idempotency: OrderedDict[str, float] = OrderedDict()
        self._rate_windows: OrderedDict[str, tuple[int, int]] = OrderedDict()

    @staticmethod
    def _identity(tenant_id: str, user_id: Optional[Union[int, str]]) -> str:
        raw = f"{tenant_id}:{user_id or 'anonymous'}".encode("utf-8")
        return hashlib.sha256(raw).hexdigest()[:24]

    async def claim_request(self, tenant_id: str, request_id: str) -> bool:
        key = f"core-ai:{tenant_id}:idempotency:{request_id}"
        client = get_redis_client()
        if client is not None:
            try:
                return bool(
                    await client.set(
                        key,
                        "processing",
                        nx=True,
                        ex=self.settings.idempotency_ttl_seconds,
                    )
                )
            except Exception:
                pass

        now = time.monotonic()
        expires = now + self.settings.idempotency_ttl_seconds
        async with self._lock:
            while self._idempotency and next(iter(self._idempotency.values())) <= now:
                self._idempotency.popitem(last=False)
            if key in self._idempotency and self._idempotency[key] > now:
                return False
            self._idempotency[key] = expires
            while len(self._idempotency) > self.max_local_keys:
                self._idempotency.popitem(last=False)
        return True

    async def allow_request(
        self, tenant_id: str, user_id: Optional[Union[int, str]]
    ) -> bool:
        identity = self._identity(tenant_id, user_id)
        window = int(time.time() // 60)
        key = f"core-ai:{tenant_id}:rate:{identity}:{window}"
        client = get_redis_client()
        if client is not None:
            try:
                count = int(await client.incr(key))
                if count == 1:
                    await client.expire(key, 65)
                return count <= self.settings.rate_limit_per_minute
            except Exception:
                pass

        async with self._lock:
            current_window, count = self._rate_windows.get(identity, (window, 0))
            if current_window != window:
                current_window, count = window, 0
            count += 1
            self._rate_windows[identity] = (current_window, count)
            self._rate_windows.move_to_end(identity)
            while len(self._rate_windows) > self.max_local_keys:
                self._rate_windows.popitem(last=False)
            return count <= self.settings.rate_limit_per_minute


_controller: Optional[RequestController] = None


def get_request_controller(settings: Optional[Settings] = None) -> RequestController:
    global _controller
    if _controller is None or (settings is not None and _controller.settings is not settings):
        _controller = RequestController(settings=settings)
    return _controller
