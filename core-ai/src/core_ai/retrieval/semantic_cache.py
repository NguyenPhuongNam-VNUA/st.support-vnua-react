"""Redis semantic cache implementation with stampede protection and degraded safety.

Key namespace structure:
    {env}:{tenant}:{purpose}:{version}:{cache_key}
Provides distributed locking during generation and graceful degradation if Redis is down.
"""

import hashlib
import json
import logging
import math
import time
from datetime import datetime, timezone
from typing import Any, List, Optional

from pydantic import BaseModel, Field

from core_ai.config import Settings, get_settings
from core_ai.contracts.chat import Citation
from core_ai.data.redis import acquire_lock, get_redis_client, is_redis_degraded, release_lock

logger = logging.getLogger("core_ai.retrieval.semantic_cache")


class CachedAnswer(BaseModel):
    """Clean, serialized cached response payload excluding any PII or internal prompts."""

    answer: str
    confidence: float = Field(default=0.95, ge=0.0, le=1.0)
    citations: List[Citation] = Field(default_factory=list)
    status: str = "answered"
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


def compute_query_hash(query: str) -> str:
    """Compute deterministic SHA-256 hash of normalized user query."""
    normalized = " ".join(query.strip().lower().split())
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()[:32]


class SemanticCache:
    """Semantic cache manager operating over Redis with degraded fallback.

    Ensures zero external AI calls on cache hits (Plan §6).
    """

    def __init__(
        self,
        settings: Optional[Settings] = None,
        default_ttl_seconds: int = 86400,  # 24 hours
        knowledge_version: Optional[str] = None,
    ) -> None:
        self.settings = settings or get_settings()
        self.default_ttl = default_ttl_seconds
        self.knowledge_version = knowledge_version or self.settings.knowledge_version

    def _build_key(self, tenant_id: str, query_hash: str) -> str:
        """Format key matching namespace: {env}:{tenant}:{purpose}:{version}:{key}."""
        env = self.settings.app_env.lower()
        return f"{env}:{tenant_id}:semantic_answer:{self.knowledge_version}:{query_hash}"

    @staticmethod
    def _scoped_query_hash(query: str, locale: str, user_scope: str) -> str:
        """Bind cached answers to locale and caller ACL without storing raw identity."""
        scope_hash = hashlib.sha256(user_scope.encode("utf-8")).hexdigest()[:16]
        return compute_query_hash(f"{locale}:{scope_hash}:{query}")

    def _build_lock_key(self, tenant_id: str, query_hash: str) -> str:
        """Format distributed stampede lock key."""
        env = self.settings.app_env.lower()
        return f"{env}:{tenant_id}:lock:semantic_answer:{query_hash}"

    def _semantic_index_key(self, tenant_id: str, locale: str, user_scope: str, topic: str) -> str:
        scope_hash = hashlib.sha256(user_scope.encode("utf-8")).hexdigest()[:16]
        return (
            f"{self.settings.app_env.lower()}:{tenant_id}:semantic_index:"
            f"{self.knowledge_version}:{self.settings.embedding_model}:"
            f"{self.settings.embedding_dimension}:{locale}:{scope_hash}:{topic}"
        )

    @staticmethod
    def _cosine(left: List[float], right: List[float]) -> float:
        if not left or len(left) != len(right):
            return 0.0
        dot = sum(a * b for a, b in zip(left, right))
        lnorm = math.sqrt(sum(a * a for a in left))
        rnorm = math.sqrt(sum(b * b for b in right))
        return dot / (lnorm * rnorm) if lnorm and rnorm else 0.0

    async def get_semantic(
        self,
        query_embedding: List[float],
        tenant_id: str = "vnua",
        locale: str = "vi-VN",
        user_scope: str = "anonymous",
        topic: str = "general",
    ) -> Optional[CachedAnswer]:
        """Search a bounded Redis index and compare vectors locally."""
        if is_redis_degraded() or len(query_embedding) != self.settings.embedding_dimension:
            return None
        client = get_redis_client()
        if client is None:
            return None
        index_key = self._semantic_index_key(tenant_id, locale, user_scope, topic)
        try:
            keys = await client.zrevrange(
                index_key, 0, self.settings.semantic_cache_max_candidates - 1
            )
            if not keys:
                return None
            cache_keys = [
                key.decode("utf-8") if isinstance(key, bytes) else str(key) for key in keys
            ]
            payloads = await client.mget(cache_keys)
            best: tuple[float, CachedAnswer] | None = None
            for raw in payloads:
                if not raw:
                    continue
                row: dict[str, Any] = json.loads(raw)
                vector = row.pop("query_embedding", [])
                score = self._cosine(query_embedding, vector)
                if score >= self.settings.semantic_cache_similarity_threshold:
                    candidate = CachedAnswer.model_validate(row)
                    if best is None or score > best[0]:
                        best = (score, candidate)
            return best[1] if best else None
        except Exception as exc:
            logger.warning("Semantic cache similarity lookup failed safely: %s", type(exc).__name__)
            return None

    async def get(
        self,
        query: str,
        tenant_id: str = "vnua",
        locale: str = "vi-VN",
        user_scope: str = "anonymous",
    ) -> Optional[CachedAnswer]:
        """Look up cached response for a query.

        Returns CachedAnswer if cache hit; None if cache miss or Redis is degraded.
        """
        if is_redis_degraded():
            return None

        client = get_redis_client()
        if client is None:
            return None

        query_hash = self._scoped_query_hash(query, locale, user_scope)
        cache_key = self._build_key(tenant_id, query_hash)

        try:
            raw_data = await client.get(cache_key)
            if raw_data is None:
                return None

            data_dict = json.loads(raw_data)
            cached = CachedAnswer.model_validate(data_dict)
            logger.info("Semantic cache HIT for query hash '%s'", query_hash[:8])
            return cached
        except Exception as exc:
            logger.warning(
                "Redis error during cache get ('%s'): %s. Bypassing cache safely.",
                cache_key,
                exc,
            )
            return None

    async def set(
        self,
        query: str,
        answer: str,
        citations: List[Citation],
        confidence: float = 0.90,
        tenant_id: str = "vnua",
        locale: str = "vi-VN",
        user_scope: str = "anonymous",
        ttl_seconds: Optional[int] = None,
        query_embedding: Optional[List[float]] = None,
        topic: str = "general",
    ) -> bool:
        """Store verified answer and citations in cache with TTL.

        Returns True if stored successfully, False if Redis is down or error occurred.
        """
        if is_redis_degraded():
            return False

        client = get_redis_client()
        if client is None:
            return False

        query_hash = self._scoped_query_hash(query, locale, user_scope)
        cache_key = self._build_key(tenant_id, query_hash)
        ttl = ttl_seconds or self.default_ttl

        payload = CachedAnswer(
            answer=answer,
            confidence=confidence,
            citations=citations,
            status="answered",
        )

        try:
            serialized = payload.model_dump_json()
            await client.set(cache_key, serialized, ex=ttl)
            if query_embedding and len(query_embedding) == self.settings.embedding_dimension:
                semantic_key = f"{cache_key}:vector"
                semantic_payload = payload.model_dump(mode="json")
                semantic_payload["query_embedding"] = query_embedding
                await client.set(semantic_key, json.dumps(semantic_payload), ex=ttl)
                index_key = self._semantic_index_key(tenant_id, locale, user_scope, topic)
                await client.zadd(index_key, {semantic_key: time.time()})
                await client.zremrangebyrank(
                    index_key, 0, -(self.settings.semantic_cache_max_candidates + 1)
                )
                await client.expire(index_key, ttl)
            logger.debug("Stored answer in semantic cache: '%s' (TTL=%ds)", cache_key, ttl)
            return True
        except Exception as exc:
            logger.warning("Failed to store in semantic cache ('%s'): %s", cache_key, exc)
            return False

    async def acquire_stampede_lock(
        self,
        query: str,
        token: str,
        tenant_id: str = "vnua",
        locale: str = "vi-VN",
        user_scope: str = "anonymous",
        ttl_seconds: int = 20,
    ) -> bool:
        """Acquire distributed lock before generating answer to prevent cache stampedes."""
        query_hash = self._scoped_query_hash(query, locale, user_scope)
        lock_key = self._build_lock_key(tenant_id, query_hash)
        return await acquire_lock(lock_key=lock_key, token=token, ttl_seconds=ttl_seconds)

    async def release_stampede_lock(
        self,
        query: str,
        token: str,
        tenant_id: str = "vnua",
        locale: str = "vi-VN",
        user_scope: str = "anonymous",
    ) -> bool:
        """Release distributed lock after generation is completed."""
        query_hash = self._scoped_query_hash(query, locale, user_scope)
        lock_key = self._build_lock_key(tenant_id, query_hash)
        return await release_lock(lock_key=lock_key, token=token)
