"""Gemini Embedding 2 client for ST-Care's pgvector retrieval pipeline."""

import asyncio
import logging
import math
from typing import List, Optional, Protocol, runtime_checkable

import httpx

from core_ai.config import Settings, get_settings
from core_ai.data.redis import get_redis_client
from core_ai.observability.metrics import record_external_call

logger = logging.getLogger("core_ai.retrieval.embeddings")

_LOCAL_RATE_LOCK = asyncio.Lock()
_LOCAL_NEXT_ALLOWED_AT = 0.0

_RESERVE_EMBEDDING_SLOT_LUA = """
local redis_time = redis.call('TIME')
local now_ms = tonumber(redis_time[1]) * 1000 + math.floor(tonumber(redis_time[2]) / 1000)
local interval_ms = tonumber(ARGV[1])
local next_ms = tonumber(redis.call('GET', KEYS[1]) or '0')
local slot_ms = math.max(now_ms, next_ms)
local reserved_until = slot_ms + interval_ms
local ttl_ms = math.max(interval_ms * 2, reserved_until - now_ms + interval_ms)
redis.call('SET', KEYS[1], reserved_until, 'PX', ttl_ms)
return slot_ms - now_ms
"""


@runtime_checkable
class EmbeddingService(Protocol):
    """Abstract protocol for embedding providers."""

    @property
    def dimension(self) -> int:
        ...

    async def embed_query(self, text: str) -> List[float]:
        """Generate a dense embedding for a user query."""
        ...

    async def embed_documents(self, texts: List[str]) -> List[List[float]]:
        """Generate dense embeddings for document chunks."""
        ...


def _l2_normalize(vector: List[float]) -> List[float]:
    """Normalize vectors defensively for pgvector cosine distance."""
    norm = math.sqrt(sum(value * value for value in vector))
    if norm < 1e-12:
        return vector
    return [value / norm for value in vector]


class GeminiEmbedding2Embeddings:
    """Async Gemini Embedding 2 implementation for asymmetric RAG retrieval.

    Gemini Embedding 2 does not accept the legacy ``task_type`` field. Google
    recommends prefixing queries and documents instead, so this adapter applies
    the question-answering query and document formats consistently.
    """

    def __init__(
        self,
        model_name: Optional[str] = None,
        dimension: Optional[int] = None,
        api_key: Optional[str] = None,
        settings: Optional[Settings] = None,
        client: Optional[httpx.AsyncClient] = None,
    ) -> None:
        self.settings = settings or get_settings()
        configured_model = model_name or self.settings.embedding_model
        self.model_name = configured_model.removeprefix("models/")
        if "/" in self.model_name:
            raise ValueError("EMBEDDING_MODEL must be a Gemini model name")

        self._dimension = dimension or self.settings.embedding_dimension
        if not 128 <= self._dimension <= 3072:
            raise ValueError("EMBEDDING_DIMENSION must be between 128 and 3072")

        self.api_key = api_key or self.settings.embedding_api_key or self.settings.llm_api_key
        if not self.api_key:
            raise ValueError(
                "Gemini embedding API key is missing; set EMBEDDING_API_KEY, "
                "GEMINI_API_KEY, or GOOGLE_API_KEY"
            )

        base_url = self.settings.embedding_base_url.rstrip("/")
        self.endpoint = f"{base_url}/models/{self.model_name}:embedContent"
        self.timeout = httpx.Timeout(self.settings.embedding_timeout_seconds)
        self.max_concurrency = self.settings.embedding_max_concurrency
        self.min_interval_seconds = self.settings.embedding_min_interval_seconds
        self.max_retries = self.settings.embedding_max_retries
        self._client = client

    @property
    def dimension(self) -> int:
        return self._dimension

    @property
    def is_external(self) -> bool:
        """Signals call-budget accounting in the orchestration layer."""
        return True

    async def _wait_for_rate_slot(self) -> None:
        """Reserve one global embedding slot, falling back to an in-process limiter."""
        if self.min_interval_seconds <= 0:
            return

        interval_ms = max(1, int(self.min_interval_seconds * 1000))
        redis_client = get_redis_client()
        if redis_client is not None:
            try:
                wait_ms = int(
                    await redis_client.eval(
                        _RESERVE_EMBEDDING_SLOT_LUA,
                        1,
                        "core-ai:embedding:next-allowed-at",
                        interval_ms,
                    )
                )
                if wait_ms > 0:
                    await asyncio.sleep(wait_ms / 1000)
                return
            except Exception as exc:
                logger.warning(
                    "Redis embedding limiter unavailable; using local limiter: %s",
                    type(exc).__name__,
                )

        global _LOCAL_NEXT_ALLOWED_AT
        loop = asyncio.get_running_loop()
        async with _LOCAL_RATE_LOCK:
            wait_seconds = max(0.0, _LOCAL_NEXT_ALLOWED_AT - loop.time())
            if wait_seconds:
                await asyncio.sleep(wait_seconds)
            _LOCAL_NEXT_ALLOWED_AT = loop.time() + self.min_interval_seconds

    async def _request_embedding_once(
        self, client: httpx.AsyncClient, text: str
    ) -> List[float]:
        payload = {
            "model": f"models/{self.model_name}",
            "content": {"parts": [{"text": text}]},
            "outputDimensionality": self._dimension,
        }
        record_external_call("gemini", self.model_name, "embedding")
        response = await client.post(
            self.endpoint,
            headers={"x-goog-api-key": self.api_key or ""},
            json=payload,
        )
        response.raise_for_status()
        raw_values = response.json()["embedding"]["values"]
        vector = [float(value) for value in raw_values]

        if len(vector) != self._dimension:
            raise RuntimeError(
                "Gemini embedding dimension mismatch: "
                f"expected {self._dimension}, got {len(vector)}"
            )
        if not all(math.isfinite(value) for value in vector):
            raise RuntimeError("Gemini embedding response contains non-finite values")
        return _l2_normalize(vector)

    async def _request_embedding(self, client: httpx.AsyncClient, text: str) -> List[float]:
        last_error: Optional[Exception] = None
        for attempt in range(self.max_retries + 1):
            await self._wait_for_rate_slot()
            try:
                return await self._request_embedding_once(client, text)
            except (httpx.HTTPError, KeyError, TypeError, ValueError) as exc:
                last_error = exc
                response = exc.response if isinstance(exc, httpx.HTTPStatusError) else None
                status_code = response.status_code if response is not None else None
                retryable = status_code is None or status_code == 429 or status_code >= 500
                if not retryable or attempt >= self.max_retries:
                    break

                retry_after = response.headers.get("retry-after") if response is not None else None
                try:
                    retry_delay = float(retry_after) if retry_after else 0.0
                except ValueError:
                    retry_delay = 0.0
                retry_delay = max(
                    retry_delay,
                    self.min_interval_seconds * (2**attempt),
                )
                logger.warning(
                    "Retrying Gemini embedding after %s (attempt %d/%d, wait %.1fs)",
                    status_code or type(exc).__name__,
                    attempt + 1,
                    self.max_retries,
                    retry_delay,
                )
                if retry_delay > 0:
                    await asyncio.sleep(retry_delay)

        raise RuntimeError(
            f"Gemini embedding request failed for model '{self.model_name}'"
        ) from last_error

    async def _embed_prepared(self, texts: List[str]) -> List[List[float]]:
        if self._client is not None:
            return [await self._request_embedding(self._client, text) for text in texts]

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            return [await self._request_embedding(client, text) for text in texts]

    async def embed_query(self, text: str) -> List[float]:
        if not text or not text.strip():
            return [0.0] * self._dimension
        prepared = f"task: question answering | query: {text.strip()}"
        return (await self._embed_prepared([prepared]))[0]

    async def embed_documents(self, texts: List[str]) -> List[List[float]]:
        if not texts:
            return []
        prepared = [f"title: none | text: {text.strip()}" for text in texts]
        return await self._embed_prepared(prepared)
