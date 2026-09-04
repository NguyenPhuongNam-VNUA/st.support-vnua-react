"""Unit Tests for Tenant-Isolated Semantic Cache Keys.

Tests:
1. Cache key namespace format compliance: {env}:{tenant}:{purpose}:{version}:{hash}.
2. Query normalization and deterministic hashing across whitespace/case variations.
3. Strict tenant isolation: identical questions in different tenants generate distinct keys.
4. Distributed lock key generation.
5. CachedAnswer payload validation.
"""

from core_ai.config import Settings
from core_ai.contracts.chat import Citation
from core_ai.retrieval.semantic_cache import (
    CachedAnswer,
    SemanticCache,
    compute_query_hash,
)


class TestTenantCacheKey:
    def test_compute_query_hash_normalization(self) -> None:
        """Queries differing only by leading/trailing spaces or letter case produce identical hashes."""
        q1 = "Học viện Nông nghiệp Việt Nam"
        q2 = "   học viện nông nghiệp việt nam   "
        q3 = "HỌC VIỆN   NÔNG NGHIỆP  VIỆT NAM"

        h1 = compute_query_hash(q1)
        h2 = compute_query_hash(q2)
        h3 = compute_query_hash(q3)

        assert h1 == h2
        assert h2 == h3
        assert len(h1) == 32  # 32-char hex digest prefix

    def test_cache_key_namespace_structure(self, mock_settings: Settings) -> None:
        """Validates key format matching {env}:{tenant}:{purpose}:{version}:{hash}."""
        cache = SemanticCache(settings=mock_settings, knowledge_version="v2")
        query_hash = "abcdef0123456789"
        key = cache._build_key(tenant_id="vnua", query_hash=query_hash)

        parts = key.split(":")
        assert len(parts) == 5
        assert parts[0] == "testing"          # env
        assert parts[1] == "vnua"             # tenant
        assert parts[2] == "semantic_answer"  # purpose
        assert parts[3] == "v2"               # knowledge_version
        assert parts[4] == query_hash         # query hash

    def test_tenant_isolation_in_cache_keys(self, mock_settings: Settings) -> None:
        """Identical queries across different tenants MUST produce different Redis keys."""
        cache = SemanticCache(settings=mock_settings)
        q_hash = compute_query_hash("Quy chế đào tạo")

        key_vnua = cache._build_key(tenant_id="vnua", query_hash=q_hash)
        key_hust = cache._build_key(tenant_id="hust", query_hash=q_hash)

        assert key_vnua != key_hust
        assert ":vnua:" in key_vnua
        assert ":hust:" in key_hust

    def test_distributed_lock_key_structure(self, mock_settings: Settings) -> None:
        """Verifies stampede lock key namespace structure."""
        cache = SemanticCache(settings=mock_settings)
        q_hash = "12345678"
        lock_key = cache._build_lock_key(tenant_id="vnua", query_hash=q_hash)

        assert lock_key == "testing:vnua:lock:semantic_answer:12345678"

    def test_cached_answer_payload_serialization(self) -> None:
        """CachedAnswer contains only safe fields and serializes/deserializes cleanly."""
        ans = CachedAnswer(
            answer="Sinh viên cần hoàn thành 125 tín chỉ.",
            confidence=0.96,
            citations=[
                Citation(
                    citation_id="src_1",
                    document_id=10,
                    title="Quy chế",
                    snippet="125 tín chỉ tối thiểu",
                )
            ],
            status="answered",
        )

        data_json = ans.model_dump_json()
        restored = CachedAnswer.model_validate_json(data_json)

        assert restored.answer == ans.answer
        assert restored.confidence == 0.96
        assert len(restored.citations) == 1
        assert restored.citations[0].citation_id == "src_1"
