"""POST /api/v1/retrieval/test runs embedding + retrieval nodes and trims to top_k."""

from typing import Any, Dict

import pytest
from fastapi.testclient import TestClient

import core_ai.api.routes.retrieval as retrieval_route

HEADERS = {"Authorization": "Bearer test-secret-token-123"}


def test_retrieval_test_returns_ranked_chunks(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    async def fake_embedding(state: Dict[str, Any]) -> Dict[str, Any]:
        state["query_embedding"] = [0.1, 0.2]
        return state

    async def fake_retrieval(state: Dict[str, Any]) -> Dict[str, Any]:
        assert "  " not in state["normalized_query"]
        state["rerank_strategy"] = "bge_cross_encoder"
        state["retrieved_chunks"] = [
            {"source_type": "document", "document_id": i, "title": f"Doc {i}", "snippet": f"s{i}", "final_score": 0.9 - i / 10}
            for i in range(3)
        ]
        return state

    monkeypatch.setattr(retrieval_route, "embedding_node", fake_embedding)
    monkeypatch.setattr(retrieval_route, "retrieval_node", fake_retrieval)

    response = client.post(
        "/api/v1/retrieval/test", json={"query": "  học   phí CNTT ", "top_k": 2}, headers=HEADERS
    )

    assert response.status_code == 200
    data = response.json()
    assert data["embedding_ready"] is True
    assert data["degraded"] is False
    assert [r["document_id"] for r in data["results"]] == [0, 1]


def test_retrieval_test_requires_token(client: TestClient) -> None:
    response = client.post("/api/v1/retrieval/test", json={"query": "học phí"})
    assert response.status_code == 401


def test_retrieval_test_validates_query(client: TestClient) -> None:
    response = client.post("/api/v1/retrieval/test", json={"query": "a"}, headers=HEADERS)
    assert response.status_code == 422
