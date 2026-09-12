"""Unit tests for the Gemini Embedding 2 adapter (no live API calls)."""

import asyncio
import json

import httpx
import pytest

from core_ai.retrieval.embeddings import GeminiEmbedding2Embeddings


@pytest.mark.asyncio
async def test_applies_gemini_2_rag_prefixes_and_dimension(mock_settings) -> None:
    requests: list[dict] = []

    async def handler(request: httpx.Request) -> httpx.Response:
        requests.append(json.loads(request.content))
        assert request.headers["x-goog-api-key"] == "test-embedding-key"
        return httpx.Response(200, json={"embedding": {"values": [1.0] * 128}})

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        service = GeminiEmbedding2Embeddings(
            model_name="models/gemini-embedding-2",
            dimension=128,
            api_key="test-embedding-key",
            settings=mock_settings,
            client=client,
        )
        query = await service.embed_query("Hạn đăng ký học phần?")
        documents = await service.embed_documents(["Quy chế đào tạo", "Lịch học kỳ"])

    assert len(query) == 128
    assert len(documents) == 2
    assert all(len(vector) == 128 for vector in documents)
    assert requests[0]["model"] == "models/gemini-embedding-2"
    assert (
        requests[0].get("outputDimensionality") == 128
        or requests[0].get("output_dimensionality") == 128
    )
    assert requests[0]["content"]["parts"][0]["text"].startswith(
        "task: question answering | query:"
    )
    assert requests[1]["content"]["parts"][0]["text"].startswith(
        "title: none | text:"
    )


@pytest.mark.asyncio
async def test_rejects_invalid_gemini_response_dimension(mock_settings) -> None:
    async def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"embedding": {"values": [1.0, 2.0]}})

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        service = GeminiEmbedding2Embeddings(
            dimension=128,
            api_key="test-embedding-key",
            settings=mock_settings,
            client=client,
        )
        with pytest.raises(RuntimeError, match="dimension mismatch"):
            await service.embed_query("test")


@pytest.mark.asyncio
async def test_surfaces_gemini_api_errors_without_fake_vector_fallback(mock_settings) -> None:
    async def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(429, json={"error": {"message": "rate limited"}})

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        service = GeminiEmbedding2Embeddings(
            dimension=128,
            api_key="test-embedding-key",
            settings=mock_settings,
            client=client,
        )
        with pytest.raises(RuntimeError, match="Gemini embedding request failed"):
            await service.embed_query("test")


@pytest.mark.asyncio
async def test_document_embedding_requests_are_serialized_by_configured_interval(
    mock_settings, monkeypatch
) -> None:
    requested_at: list[float] = []

    async def handler(request: httpx.Request) -> httpx.Response:
        requested_at.append(asyncio.get_running_loop().time())
        return httpx.Response(200, json={"embedding": {"values": [1.0] * 128}})

    settings = mock_settings.model_copy(
        update={"embedding_min_interval_seconds": 0.1, "embedding_max_retries": 0}
    )
    monkeypatch.setattr("core_ai.retrieval.embeddings.get_redis_client", lambda: None)
    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        service = GeminiEmbedding2Embeddings(
            dimension=128,
            api_key="test-embedding-key",
            settings=settings,
            client=client,
        )
        await service.embed_documents(["chunk one", "chunk two"])

    assert len(requested_at) == 2
    assert requested_at[1] - requested_at[0] >= 0.08


@pytest.mark.asyncio
async def test_embedding_retries_rate_limit_without_fake_vector(mock_settings) -> None:
    attempts = 0

    async def handler(request: httpx.Request) -> httpx.Response:
        nonlocal attempts
        attempts += 1
        if attempts == 1:
            return httpx.Response(429, headers={"Retry-After": "0"})
        return httpx.Response(200, json={"embedding": {"values": [1.0] * 128}})

    settings = mock_settings.model_copy(update={"embedding_max_retries": 1})
    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        service = GeminiEmbedding2Embeddings(
            dimension=128,
            api_key="test-embedding-key",
            settings=settings,
            client=client,
        )
        vector = await service.embed_query("test")

    assert attempts == 2
    assert len(vector) == 128
