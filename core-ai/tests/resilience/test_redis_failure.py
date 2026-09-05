"""Resilience Tests for Redis Outage and Degraded-Safe Pipeline Operations.

CRITICAL INSTRUCTION:
A failure or disconnection of the internal Redis cache MUST NOT crash the chat pipeline.
The microservice automatically degrades: bypassing semantic cache and proceeding to retrieval safely.
"""

from unittest.mock import AsyncMock, patch

import pytest

from core_ai.retrieval.semantic_cache import CachedAnswer, SemanticCache


class TestRedisFailureResilience:
    @pytest.mark.asyncio
    async def test_cache_get_bypasses_on_redis_connection_error(self) -> None:
        """When Redis throws ConnectionError on get(), SemanticCache returns None without raising."""
        broken_redis = AsyncMock()
        broken_redis.get.side_effect = ConnectionError("Redis server went away")

        with patch("core_ai.retrieval.semantic_cache.get_redis_client", return_value=broken_redis):
            with patch("core_ai.retrieval.semantic_cache.is_redis_degraded", return_value=False):
                cache = SemanticCache()
                result = await cache.get("Học phí VNUA?", tenant_id="vnua")
                # Degraded-safe: returns None (miss) to allow normal retrieval path
                assert result is None

    @pytest.mark.asyncio
    async def test_cache_set_bypasses_on_redis_error(self) -> None:
        """When Redis throws on set(), SemanticCache silently catches error without raising."""
        broken_redis = AsyncMock()
        broken_redis.set.side_effect = ConnectionError("Cannot write to Redis")

        with patch("core_ai.retrieval.semantic_cache.get_redis_client", return_value=broken_redis):
            with patch("core_ai.retrieval.semantic_cache.is_redis_degraded", return_value=False):
                cache = SemanticCache()
                cached_obj = CachedAnswer(
                    answer="Thông tin học phí",
                    confidence=0.9,
                    citations=[],
                )
                success = await cache.set(
                    "Học phí VNUA?",
                    cached_obj.answer,
                    citations=cached_obj.citations,
                    tenant_id="vnua",
                )
                assert success is False

    @pytest.mark.asyncio
    async def test_readiness_probe_returns_degraded_when_redis_unreachable(
        self, test_app
    ) -> None:
        """GET /health/ready returns HTTP 200 with status='degraded' when Redis fails."""
        broken_redis = AsyncMock()
        broken_redis.ping.side_effect = ConnectionError("Redis down")

        from fastapi.testclient import TestClient

        from core_ai.dependencies import register_component

        register_component("redis_client", broken_redis)

        with patch("core_ai.data.postgres.check_db_health", new_callable=AsyncMock, return_value=True):
            client = TestClient(test_app)
            response = client.get("/health/ready")

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "degraded"
        assert "unavailable" in data["redis"].lower() or "degraded" in data["redis"].lower()

    def test_readiness_returns_503_when_primary_database_is_down(self, client) -> None:
        """Database is mandatory even though Redis may degrade safely."""
        with patch(
            "core_ai.data.postgres.check_db_health",
            new=AsyncMock(return_value=False),
        ), patch(
            "core_ai.data.redis.check_redis_health",
            new=AsyncMock(return_value=True),
        ):
            response = client.get("/health/ready")

        assert response.status_code == 503
        assert response.json()["status"] == "unhealthy"
