"""End-to-End Tests for Semantic Cache Hit Workflow.

CRITICAL INSTRUCTION:
A semantic cache hit must consume EXACTLY ZERO external AI calls.
The response is immediately served from Redis with verified citations and safe metadata.
"""

import json
from unittest.mock import AsyncMock

import pytest
from fastapi.testclient import TestClient

from core_ai.contracts.chat import Citation
from core_ai.retrieval.semantic_cache import (
    CachedAnswer,
    compute_query_hash,
)


class TestCacheHitFlowE2E:
    @pytest.mark.asyncio
    async def test_cache_hit_consumes_zero_external_ai_calls(
        self,
        client: TestClient,
        mock_redis,
        mock_litellm_completion: AsyncMock,
    ) -> None:
        """Cache hit serves answer immediately without invoking external LLM (0 external calls)."""
        question = "Quy định số tín chỉ tích lũy tối thiểu để tốt nghiệp VNUA?"
        tenant_id = "vnua"

        # Pre-seed cache with verified answer
        q_hash = compute_query_hash(question)
        cache_key = f"testing:{tenant_id}:semantic_answer:v1:{q_hash}"

        cached_entry = CachedAnswer(
            answer="Sinh viên cần tích lũy tối thiểu 125 tín chỉ để được xét tốt nghiệp đại học chính quy.",
            confidence=0.98,
            citations=[
                Citation(
                    citation_id="src_cache_1",
                    document_id=101,
                    title="Quy chế đào tạo đại học VNUA",
                    page=12,
                    snippet="Tối thiểu 125 tín chỉ",
                    relevance_score=0.98,
                )
            ],
            status="answered",
        )

        await mock_redis.set(cache_key, cached_entry.model_dump_json())

        # Register semantic cache in component registry returning cached payload
        from core_ai.dependencies import register_component
        mock_cache = AsyncMock()
        mock_cache.get = AsyncMock(
            return_value={
                "answer": cached_entry.answer,
                "confidence": cached_entry.confidence,
                "citations": [c.model_dump() for c in cached_entry.citations],
            }
        )
        register_component("semantic_cache", mock_cache)

        # Now send chat request for identical question
        payload = {
            "request_id": "test-cache-hit-1",
            "tenant_id": tenant_id,
            "conversation_id": "conv-cache-1",
            "message": question,
        }
        headers = {"Authorization": "Bearer test-secret-token-123"}

        response = client.post("/v1/chat", json=payload, headers=headers)
        assert response.status_code == 200

        # Parse completed event
        lines = response.text.splitlines()
        completed_data = None
        for i, line in enumerate(lines):
            if "event: answer.completed" in line:
                for j in range(i + 1, len(lines)):
                    if lines[j].startswith("data:"):
                        completed_data = json.loads(lines[j].replace("data:", "").strip())
                        break
                break

        assert completed_data is not None
        assert "125 tín chỉ" in completed_data["answer"]
        assert len(completed_data["citations"]) >= 1

        # Strict call budget verification: 0 external model calls!
        mock_litellm_completion.assert_not_awaited()
