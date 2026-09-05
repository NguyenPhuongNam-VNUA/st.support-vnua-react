"""Gemini Embedding 2 client for ST-Care's pgvector retrieval pipeline."""

import asyncio
import logging
import math
from typing import List, Optional, Protocol, runtime_checkable

import httpx

from core_ai.config import Settings, get_settings
from core_ai.observability.metrics import record_external_call

logger = logging.getLogger("core_ai.retrieval.embeddings")


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
        self._client = client

    @property
    def dimension(self) -> int:
        return self._dimension

    @property
    def is_external(self) -> bool:
        """Signals call-budget accounting in the orchestration layer."""
        return True

    async def _request_embedding(self, client: httpx.AsyncClient, text: str) -> List[float]:
        payload = {
            "model": f"models/{self.model_name}",
            "content": {"parts": [{"text": text}]},
            "outputDimensionality": self._dimension,
        }
        try:
            record_external_call("gemini", self.model_name, "embedding")
            response = await client.post(
                self.endpoint,
                headers={"x-goog-api-key": self.api_key or ""},
                json=payload,
            )
            response.raise_for_status()
            raw_values = response.json()["embedding"]["values"]
            vector = [float(value) for value in raw_values]
        except (httpx.HTTPError, KeyError, TypeError, ValueError) as exc:
            raise RuntimeError(
                f"Gemini embedding request failed for model '{self.model_name}'"
            ) from exc

        if len(vector) != self._dimension:
            raise RuntimeError(
                "Gemini embedding dimension mismatch: "
                f"expected {self._dimension}, got {len(vector)}"
            )
        if not all(math.isfinite(value) for value in vector):
            raise RuntimeError("Gemini embedding response contains non-finite values")
        return _l2_normalize(vector)

    async def _embed_prepared(self, texts: List[str]) -> List[List[float]]:
        semaphore = asyncio.Semaphore(self.max_concurrency)

        async def request_one(client: httpx.AsyncClient, text: str) -> List[float]:
            async with semaphore:
                return await self._request_embedding(client, text)

        if self._client is not None:
            return await asyncio.gather(*(request_one(self._client, text) for text in texts))

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            return await asyncio.gather(*(request_one(client, text) for text in texts))

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
