"""Global Pytest Fixtures and Mock Adapters for ST-Care Core AI.

All test suites execute 100% offline and in-memory with ZERO dependencies on:
- Live PostgreSQL / Supavisor databases
- Live Redis instances
- Live OpenAI / Gemini / LiteLLM external APIs
- Live MCP tool servers or Docker engines
"""

import asyncio
from contextlib import asynccontextmanager
import json
import time
from typing import Any, AsyncGenerator, Dict, Generator, List, Optional
from unittest.mock import AsyncMock, MagicMock, patch

from fastapi import FastAPI
from fastapi.testclient import TestClient
import httpx
import pytest

from core_ai.config import Settings, get_settings
from core_ai.contracts.chat import ChatRequest, Citation, RouteStatus
from core_ai.contracts.llm import ChatMessage, GenerationRequest, GenerationResult, TokenUsage
from core_ai.contracts.mcp import ToolRequest, ToolResult
from core_ai.dependencies import clear_components, register_component
from core_ai.guardrails.input_guardrail import InputGuardrail
from core_ai.guardrails.output_guardrail import OutputGuardrail
from core_ai.llm.gateway import LLMGateway
from core_ai.mcp.gateway import MCPGatewayImpl
from core_ai.main import create_app
from core_ai.retrieval.bm25 import RankedChunk


# ------------------------------------------------------------------------------
# 1. Settings & Configuration Fixtures
# ------------------------------------------------------------------------------
@pytest.fixture
def mock_settings() -> Settings:
    """Provides an isolated test configuration with test tokens and safe boundaries."""
    return Settings(
        app_env="testing",
        core_ai_host="127.0.0.1",
        core_ai_port=5001,
        internal_service_token="test-secret-token-123",
        default_tenant="vnua",
        allowed_tenants=["vnua", "test_tenant"],
        llm_provider="gemini",
        llm_model="gemini-3.5-flash",
        llm_timeout_seconds=5.0,
        llm_max_external_calls=2,
        embedding_provider="gemini",
        embedding_model="gemini-embedding-2",
        embedding_dimension=1024,
        database_url="postgresql://test:test@localhost:6543/postgres",
        db_statement_cache_size=0,
        redis_url="redis://localhost:6379/0",
        mcp_transport="streamable-http",
        mcp_tool_timeout_seconds=2.0,
        mcp_allowed_tools=[
            "search_knowledge",
            "lookup_schedule",
            "check_tuition",
            "get_regulations",
            "create_support_case",
        ],
        otel_service_name="st-care-core-ai-test",
        log_raw_prompts=False,
    )


# ------------------------------------------------------------------------------
# 2. In-Memory Mock Redis Client
# ------------------------------------------------------------------------------
class InMemoryMockRedis:
    """Asynchronous in-memory Redis mock replicating key-value storage, TTL, and Lua lock release."""

    def __init__(self) -> None:
        self.store: Dict[str, str] = {}
        self.ttls: Dict[str, float] = {}
        self.is_connected = True
        self.counters: Dict[str, int] = {}

    async def ping(self) -> bool:
        if not self.is_connected:
            raise ConnectionError("Redis connection refused (simulated failure)")
        return True

    async def get(self, key: str) -> Optional[str]:
        if not self.is_connected:
            raise ConnectionError("Redis down")
        val = self.store.get(key)
        if val is not None and key in self.ttls and time.time() > self.ttls[key]:
            del self.store[key]
            del self.ttls[key]
            return None
        return val

    async def set(
        self,
        key: str,
        value: str,
        ex: Optional[int] = None,
        nx: bool = False,
    ) -> bool:
        if not self.is_connected:
            raise ConnectionError("Redis down")
        if nx and key in self.store:
            return False
        self.store[key] = str(value)
        if ex:
            self.ttls[key] = time.time() + ex
        return True

    async def setex(self, key: str, time_secs: int, value: str) -> bool:
        return await self.set(key, value, ex=time_secs)

    async def incr(self, key: str) -> int:
        self.counters[key] = self.counters.get(key, 0) + 1
        return self.counters[key]

    async def expire(self, key: str, seconds: int) -> bool:
        self.ttls[key] = time.time() + seconds
        return True

    async def delete(self, *keys: str) -> int:
        if not self.is_connected:
            raise ConnectionError("Redis down")
        count = 0
        for k in keys:
            if k in self.store:
                del self.store[k]
                self.ttls.pop(k, None)
                count += 1
        return count

    async def exists(self, *keys: str) -> int:
        if not self.is_connected:
            raise ConnectionError("Redis down")
        return sum(1 for k in keys if k in self.store)

    async def eval(self, script: str, numkeys: int, *keys_and_args: Any) -> Any:
        if not self.is_connected:
            raise ConnectionError("Redis down")
        # Handle atomic lock release script
        if numkeys == 1 and len(keys_and_args) >= 2:
            key = keys_and_args[0]
            val = keys_and_args[1]
            if self.store.get(key) == str(val):
                del self.store[key]
                return 1
            return 0
        return 1

    async def aclose(self) -> None:
        self.store.clear()
        self.ttls.clear()


@pytest.fixture
def mock_redis() -> InMemoryMockRedis:
    """Fixture providing an isolated in-memory Redis instance."""
    return InMemoryMockRedis()


# ------------------------------------------------------------------------------
# 3. Mock Database Connection & asyncpg Pool
# ------------------------------------------------------------------------------
@pytest.fixture
def mock_db_conn() -> AsyncMock:
    """Mock asyncpg connection executing queries against mock record sets."""
    conn = AsyncMock()
    conn.fetch.return_value = [
        {
            "id": 1,
            "document_id": 101,
            "chunk_index": 0,
            "page": 12,
            "tokens": 20,
            "content": "Sinh viên đại học chính quy Học viện Nông nghiệp Việt Nam cần tích lũy tối thiểu 125 tín chỉ để tốt nghiệp.",
            "document_title": "Quy chế đào tạo đại học",
            "metadata": {"title": "Quy chế đào tạo đại học", "page": 12},
            "similarity": 0.88,
            "fts_score": 0.85,
            "created_at": None,
        },
        {
            "id": 2,
            "document_id": 102,
            "chunk_index": 1,
            "page": 3,
            "tokens": 18,
            "content": "Học phí tín chỉ được tính theo định mức của từng chuyên ngành đào tạo và công bố vào đầu năm học.",
            "document_title": "Quy định thu học phí 2024",
            "metadata": {"title": "Quy định thu học phí 2024", "page": 3},
            "similarity": 0.82,
            "fts_score": 0.80,
            "created_at": None,
        },
    ]
    conn.fetchrow.return_value = {"total": 2, "status": "ready"}
    conn.fetchval.return_value = 1
    conn.execute.return_value = "UPDATE 1"
    return conn


@pytest.fixture
def mock_db_pool(mock_db_conn: AsyncMock) -> MagicMock:
    """Mock asyncpg Pool conforming to Supavisor transaction pooler interface."""
    pool = MagicMock()

    @asynccontextmanager
    async def _acquire(timeout: Optional[float] = None) -> AsyncGenerator[AsyncMock, None]:
        del timeout
        yield mock_db_conn

    pool.acquire = _acquire
    pool.release = AsyncMock()
    pool.close = AsyncMock()
    pool.is_closing.return_value = False
    pool.get_size.return_value = 1
    pool.get_idle_size.return_value = 1
    return pool


# ------------------------------------------------------------------------------
# 4. Mock Embedding Service (Gemini Embedding 2-compatible 1024d)
# ------------------------------------------------------------------------------
class MockEmbeddingService:
    """Mock embedding generator producing synthetic 1024-dimensional normalized vectors."""

    def __init__(self, dimension: int = 1024) -> None:
        self.dimension = dimension
        self.is_external = True

    async def embed_query(self, text: str) -> List[float]:
        # Generate deterministic vector based on text hash
        val = (abs(hash(text)) % 1000) / 1000.0
        vec = [val] * self.dimension
        # Normalize
        norm = sum(x * x for x in vec) ** 0.5 or 1.0
        return [round(x / norm, 6) for x in vec]

    async def embed_documents(self, texts: List[str]) -> List[List[float]]:
        return [await self.embed_query(t) for t in texts]


@pytest.fixture
def mock_embedding_service() -> MockEmbeddingService:
    return MockEmbeddingService(dimension=1024)


# ------------------------------------------------------------------------------
# 5. Mock LiteLLM Completion Adapter
# ------------------------------------------------------------------------------
class MockLiteLLMResponse:
    """Mock response imitating litellm.ModelResponse structure."""

    def __init__(
        self,
        content: str,
        model: str = "gemini/gemini-3.5-flash",
        prompt_tokens: int = 35,
        completion_tokens: int = 42,
    ) -> None:
        self.id = "mock-call-12345"
        self.model = model
        message_mock = MagicMock()
        message_mock.content = content
        message_mock.role = "assistant"

        choice_mock = MagicMock()
        choice_mock.message = message_mock
        choice_mock.finish_reason = "stop"
        self.choices = [choice_mock]

        usage_mock = MagicMock()
        usage_mock.prompt_tokens = prompt_tokens
        usage_mock.completion_tokens = completion_tokens
        usage_mock.total_tokens = prompt_tokens + completion_tokens
        self.usage = usage_mock


@pytest.fixture
def mock_litellm_completion() -> Generator[AsyncMock, None, None]:
    """Patches litellm.acompletion with a deterministic assistant response."""
    default_text = (
        "Theo Quy chế đào tạo của Học viện Nông nghiệp Việt Nam [src_1], "
        "sinh viên cần hoàn thành đủ số tín chỉ tích lũy theo chương trình đào tạo để được xét tốt nghiệp."
    )
    mock_resp = MockLiteLLMResponse(content=default_text)

    with patch("litellm.acompletion", new_callable=AsyncMock) as mocked:
        mocked.return_value = mock_resp
        yield mocked


# ------------------------------------------------------------------------------
# 6. Mock Ranked Chunks & Citations Datasets
# ------------------------------------------------------------------------------
@pytest.fixture
def sample_ranked_chunks() -> List[RankedChunk]:
    """Sample retrieved chunks representing hybrid search candidates."""
    return [
        RankedChunk(
            chunk_id=1,
            document_id=101,
            chunk_index=0,
            document_title="Quy chế đào tạo đại học VNUA",
            content="Sinh viên được đăng ký tối đa 24 tín chỉ trong học kỳ chính và 8 tín chỉ trong học kỳ phụ.",
            page=14,
            rank=1,
            similarity=0.91,
            fts_score=0.85,
            rrf_score=0.95,
            rerank_score=0.92,
            retrieval_source="hybrid",
        ),
        RankedChunk(
            chunk_id=2,
            document_id=101,
            chunk_index=1,
            document_title="Quy chế đào tạo đại học VNUA",
            content="Điểm trung bình tích lũy đạt từ 2.00 trở lên là điều kiện tiên quyết để xét tốt nghiệp.",
            page=15,
            rank=2,
            similarity=0.85,
            fts_score=0.78,
            rrf_score=0.88,
            rerank_score=0.86,
            retrieval_source="dense",
        ),
        RankedChunk(
            chunk_id=3,
            document_id=102,
            chunk_index=0,
            document_title="Quy định học phí năm học 2024-2025",
            content="Học phí đóng theo từng học kỳ theo thông báo của Ban Tài chính và Kế toán VNUA.",
            page=2,
            rank=3,
            similarity=0.79,
            fts_score=0.75,
            rrf_score=0.79,
            rerank_score=0.78,
            retrieval_source="sparse",
        ),
    ]


@pytest.fixture
def sample_citations() -> List[Citation]:
    """Sample verified citations matching sample_ranked_chunks."""
    return [
        Citation(
            citation_id="src_1",
            document_id=101,
            title="Quy chế đào tạo đại học VNUA",
            page=14,
            chunk_index=0,
            snippet="Sinh viên được đăng ký tối đa 24 tín chỉ trong học kỳ chính và 8 tín chỉ trong học kỳ phụ.",
            relevance_score=0.92,
        ),
        Citation(
            citation_id="src_2",
            document_id=102,
            title="Quy định học phí năm học 2024-2025",
            page=2,
            chunk_index=0,
            snippet="Học phí đóng theo từng học kỳ theo thông báo của Ban Tài chính và Kế toán VNUA.",
            relevance_score=0.78,
        ),
    ]


@pytest.fixture
def sample_chat_request() -> ChatRequest:
    """Standard valid ChatRequest from student."""
    return ChatRequest(
        request_id="test-req-1234-abcd",
        tenant_id="vnua",
        user_id="student_sv651234",
        conversation_id="conv-5566-7788",
        message="Một học kỳ sinh viên VNUA được đăng ký tối đa bao nhiêu tín chỉ?",
        locale="vi-VN",
        channel="web",
    )


# ------------------------------------------------------------------------------
# 7. FastAPI App & TestClient Fixtures
# ------------------------------------------------------------------------------
@pytest.fixture
def test_app(
    mock_settings: Settings,
    mock_redis: InMemoryMockRedis,
    mock_db_pool: MagicMock,
    mock_embedding_service: MockEmbeddingService,
    sample_ranked_chunks: List[RankedChunk],
) -> FastAPI:
    """Instantiates a test FastAPI application with mocked singletons registered."""
    clear_components()
    with patch("core_ai.config.get_settings", return_value=mock_settings):
        app = create_app(settings=mock_settings)

        # Pre-populate dependency container singletons with mocks
        register_component("db_pool", mock_db_pool)
        register_component("redis_client", mock_redis)
        register_component("embedding_service", mock_embedding_service)
        vector_retriever = MagicMock()
        vector_retriever.embedding_service = mock_embedding_service
        hybrid_retriever = MagicMock()
        hybrid_retriever.vector_retriever = vector_retriever
        hybrid_retriever.retrieve_parallel = AsyncMock(
            return_value=(sample_ranked_chunks, [])
        )
        register_component("hybrid_retriever", hybrid_retriever)
        register_component("llm_port", LLMGateway(settings=mock_settings))
        register_component("mcp_gateway", MCPGatewayImpl(settings=mock_settings))
        register_component("input_guardrail", InputGuardrail())
        register_component("output_guardrail", OutputGuardrail())
        cache = AsyncMock()
        cache.get.return_value = None
        cache.acquire_stampede_lock.return_value = True
        cache.release_stampede_lock.return_value = True
        cache.set.return_value = True
        register_component("semantic_cache", cache)
        register_component("ingestion_worker", AsyncMock())

        return app


@pytest.fixture
def client(test_app: FastAPI) -> Generator[TestClient, None, None]:
    """Synchronous FastAPI TestClient for contract and route testing."""
    with TestClient(test_app) as c:
        yield c


@pytest.fixture
async def async_client(test_app: FastAPI) -> AsyncGenerator[httpx.AsyncClient, None]:
    """Asynchronous HTTPX client for testing SSE streaming endpoints."""
    transport = httpx.ASGITransport(app=test_app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
