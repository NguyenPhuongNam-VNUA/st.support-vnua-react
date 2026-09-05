import json
from unittest.mock import patch

import pytest

from core_ai.contracts.chat import Citation
from core_ai.retrieval.semantic_cache import SemanticCache


class VectorRedis:
    def __init__(self) -> None:
        self.values: dict[str, str] = {}
        self.indexes: dict[str, dict[str, float]] = {}

    async def set(self, key, value, **_kwargs):
        self.values[str(key)] = str(value)

    async def zadd(self, key, values):
        self.indexes.setdefault(str(key), {}).update(values)

    async def zremrangebyrank(self, *_args):
        return 0

    async def expire(self, *_args):
        return True

    async def zrevrange(self, key, start, end):
        rows = sorted(self.indexes.get(str(key), {}).items(), key=lambda row: row[1], reverse=True)
        return [row[0] for row in rows[start : end + 1]]

    async def mget(self, keys):
        return [self.values.get(str(key)) for key in keys]


@pytest.mark.asyncio
async def test_semantic_cache_is_tenant_and_scope_isolated(mock_settings) -> None:
    redis = VectorRedis()
    cache = SemanticCache(settings=mock_settings)
    vector = [0.03125] * 1024
    citation = Citation(
        citation_id="src_1", document_id=1, chunk_index=0, title="QĐ", snippet="Nội dung"
    )
    with (
        patch("core_ai.retrieval.semantic_cache.get_redis_client", return_value=redis),
        patch("core_ai.retrieval.semantic_cache.is_redis_degraded", return_value=False),
    ):
        assert await cache.set(
            "học phí",
            "Câu trả lời [src_1]",
            [citation],
            tenant_id="vnua",
            user_scope="account:1",
            topic="tuition",
            query_embedding=vector,
        )
        assert await cache.get_semantic(
            vector, tenant_id="vnua", user_scope="account:1", topic="tuition"
        )
        assert (
            await cache.get_semantic(
                vector, tenant_id="other", user_scope="account:1", topic="tuition"
            )
            is None
        )
        assert not any("học phí" in key for key in redis.values)
        assert all(json.loads(value) for value in redis.values.values())
