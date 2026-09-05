"""Dependency injection container and FastAPI dependencies.

Provides request context, authentication verification, settings, and provider hooks
for route handlers and background pipelines.
"""

import logging
from typing import Any, Optional

from fastapi import Depends, HTTPException, Request, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from core_ai.api.middleware.auth import validate_token
from core_ai.api.middleware.request_context import (
    RequestContext,
    request_id_ctx,
    tenant_id_ctx,
    user_id_ctx,
)
from core_ai.config import Settings, get_settings
from core_ai.contracts.errors import ErrorCode

logger = logging.getLogger("core_ai.dependencies")
bearer_scheme = HTTPBearer(auto_error=False)


def get_app_settings() -> Settings:
    """Dependency for injecting cached Settings."""
    return get_settings()


def get_request_context(request: Request) -> RequestContext:
    """Retrieves current strongly-typed RequestContext from request state or ContextVars."""
    ctx: Optional[RequestContext] = getattr(request.state, "context", None)
    if ctx is not None:
        return ctx
    # Fallback to ContextVars if state was not populated
    return RequestContext(
        request_id=request_id_ctx.get() or "unknown",
        tenant_id=tenant_id_ctx.get() or "vnua",
        user_id=user_id_ctx.get(),
    )


async def verify_internal_token(
    credentials: Optional[HTTPAuthorizationCredentials] = Security(bearer_scheme),
    settings: Settings = Depends(get_app_settings),
) -> str:
    """FastAPI route-level dependency verifying Bearer internal service token."""
    expected_token = settings.internal_service_token

    # In dev environment without configured token, allow through
    if not expected_token and settings.app_env.lower() == "development":
        return "dev-bypass"

    if credentials is None or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "error_code": ErrorCode.AUTH_FAILED.value,
                "message": "Thiếu Authorization header dạng Bearer token",
                "retryable": False,
            },
        )

    if not validate_token(credentials.credentials, expected_token):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "error_code": ErrorCode.AUTH_FAILED.value,
                "message": "Token dịch vụ nội bộ không chính xác",
                "retryable": False,
            },
        )

    return credentials.credentials


# Registry hooks for sub-agent component injections (populated during app lifespan)
_component_registry: dict[str, Any] = {}


def register_component(name: str, instance: Any) -> None:
    """Register a singleton component in the app container."""
    _component_registry[name] = instance


def clear_components() -> None:
    """Clear process-local overrides; intended for isolated app/test lifecycles."""
    _component_registry.clear()


def _runtime_settings() -> Settings:
    configured = _component_registry.get("settings")
    return configured if isinstance(configured, Settings) else get_settings()


def get_component(name: str) -> Optional[Any]:
    """Retrieve a singleton component from the app container with lazy fallbacks."""
    if name in _component_registry and _component_registry[name] is not None:
        return _component_registry[name]

    if name == "graph_runner":
        try:
            try:
                from core_ai.graph.runner import get_graph_runner
                runner = get_graph_runner()
            except (ImportError, AttributeError):
                import core_ai.graph.runner as runner_mod
                if hasattr(runner_mod, "get_graph_runner"):
                    runner = runner_mod.get_graph_runner()
                elif hasattr(runner_mod, "default_runner"):
                    runner = runner_mod.default_runner
                else:
                    runner = _component_registry.get("graph_runner")
            if runner is not None:
                _component_registry["graph_runner"] = runner
            return runner
        except Exception as exc:
            logger.exception("Failed to initialize or retrieve graph_runner: %s", exc)
            return _component_registry.get("graph_runner")

    if name == "llm_port":
        try:
            from core_ai.llm.gateway import get_llm_gateway
            gateway = get_llm_gateway(_runtime_settings())
            if gateway is not None:
                _component_registry["llm_port"] = gateway
            return gateway
        except Exception:
            return _component_registry.get("llm_port")

    if name == "mcp_gateway":
        try:
            from core_ai.mcp.gateway import get_mcp_gateway
            gateway = get_mcp_gateway(_runtime_settings())
            if gateway is not None:
                _component_registry["mcp_gateway"] = gateway
            return gateway
        except Exception:
            return _component_registry.get("mcp_gateway")

    if name in ("hybrid_retriever", "retriever", "retrieval_service", "vector_search"):
        try:
            try:
                from core_ai.retrieval.vector_search import get_hybrid_retriever as _get_retriever
                retriever = _get_retriever()
            except (ImportError, AttributeError):
                retriever = get_hybrid_retriever()
            if retriever is not None:
                _component_registry["hybrid_retriever"] = retriever
                _component_registry["retriever"] = retriever
                _component_registry["retrieval_service"] = retriever
                _component_registry["vector_search"] = retriever
            return retriever
        except Exception:
            return _component_registry.get(name)

    if name == "semantic_cache":
        try:
            try:
                from core_ai.retrieval.semantic_cache import get_semantic_cache as _get_cache
                cache = _get_cache()
            except (ImportError, AttributeError):
                cache = get_semantic_cache()
            if cache is not None:
                _component_registry["semantic_cache"] = cache
            return cache
        except Exception:
            return _component_registry.get("semantic_cache")

    if name == "document_repo":
        try:
            try:
                from core_ai.data.repositories.document_repo import (
                    get_document_repo as _get_doc_repo,
                )
                repo = _get_doc_repo()
            except (ImportError, AttributeError):
                repo = get_document_repository()
            if repo is not None:
                _component_registry["document_repo"] = repo
            return repo
        except Exception:
            return _component_registry.get("document_repo")

    if name == "db_pool":
        try:
            from core_ai.data.postgres import get_db_pool
            pool = get_db_pool()
            if pool is not None:
                _component_registry["db_pool"] = pool
            return pool
        except Exception:
            return _component_registry.get("db_pool")

    if name == "redis_client":
        try:
            from core_ai.data.redis import get_redis_client
            client = get_redis_client()
            if client is not None:
                _component_registry["redis_client"] = client
            return client
        except Exception:
            return _component_registry.get("redis_client")

    if name == "input_guardrail":
        return get_input_guardrail()
    if name == "output_guardrail":
        return get_output_guardrail()
    if name == "ingestion_worker":
        return get_ingestion_worker()
    if name == "embedding_service":
        return get_embedding_service()
    if name == "local_reranker":
        return get_local_reranker()
    if name == "prompt_guard_model":
        return get_prompt_guard_model()
    if name == "context_builder":
        return get_context_builder()

    return None


def get_document_repository() -> Any:
    """Dependency for injecting DocumentRepository singleton."""
    repo = _component_registry.get("document_repo")
    if repo is None:
        from core_ai.data.repositories.document_repo import DocumentRepository
        repo = DocumentRepository(settings=_runtime_settings())
        register_component("document_repo", repo)
    return repo


get_document_repo = get_document_repository


def get_question_repository() -> Any:
    """Dependency for injecting QuestionRepository singleton."""
    repo = _component_registry.get("question_repo")
    if repo is None:
        from core_ai.data.repositories.question_repo import QuestionRepository
        repo = QuestionRepository(settings=_runtime_settings())
        register_component("question_repo", repo)
    return repo


def get_embedding_service() -> Any:
    """Dependency for injecting the Gemini Embedding 2 singleton."""
    service = _component_registry.get("embedding_service")
    if service is None:
        from core_ai.retrieval.embeddings import GeminiEmbedding2Embeddings
        service = GeminiEmbedding2Embeddings(settings=_runtime_settings())
        register_component("embedding_service", service)
    return service


def get_semantic_cache() -> Any:
    """Dependency for injecting SemanticCache singleton."""
    cache = _component_registry.get("semantic_cache")
    if cache is None:
        from core_ai.retrieval.semantic_cache import SemanticCache
        cache = SemanticCache(settings=_runtime_settings())
        register_component("semantic_cache", cache)
    return cache


def get_hybrid_retriever() -> Any:
    """Dependency for injecting ParallelHybridRetriever singleton."""
    retriever = _component_registry.get("hybrid_retriever")
    if retriever is None:
        from core_ai.retrieval.bm25 import BM25Retriever
        from core_ai.retrieval.vector_search import ParallelHybridRetriever, VectorRetriever
        doc_repo = get_document_repository()
        emb_service = get_embedding_service()
        v_retriever = VectorRetriever(embedding_service=emb_service, document_repo=doc_repo)
        b_retriever = BM25Retriever(document_repo=doc_repo)
        retriever = ParallelHybridRetriever(vector_retriever=v_retriever, bm25_retriever=b_retriever)
        register_component("hybrid_retriever", retriever)
        register_component("retrieval_service", retriever)
        register_component("vector_search", retriever)
        register_component("retriever", retriever)
    return retriever


def get_local_reranker() -> Any:
    """Dependency for model-backed reranking with a no-model fallback."""
    reranker = _component_registry.get("local_reranker")
    if reranker is None:
        from core_ai.retrieval.model_reranker import ModelReranker
        reranker = ModelReranker(settings=_runtime_settings())
        register_component("local_reranker", reranker)
    return reranker


def get_prompt_guard_model() -> Any:
    guard = _component_registry.get("prompt_guard_model")
    if guard is None:
        from core_ai.guardrails.prompt_guard_model import PromptGuardModel
        guard = PromptGuardModel(settings=_runtime_settings())
        register_component("prompt_guard_model", guard)
    return guard


def get_context_builder() -> Any:
    """Dependency for injecting ContextBuilder singleton."""
    builder = _component_registry.get("context_builder")
    if builder is None:
        from core_ai.retrieval.context_builder import ContextBuilder
        builder = ContextBuilder()
        register_component("context_builder", builder)
    return builder


def get_input_guardrail() -> Any:
    """Dependency for injecting InputGuardrail singleton."""
    guardrail = _component_registry.get("input_guardrail")
    if guardrail is None:
        from core_ai.guardrails.input_guardrail import InputGuardrail
        guardrail = InputGuardrail()
        register_component("input_guardrail", guardrail)
    return guardrail


def get_output_guardrail() -> Any:
    """Dependency for injecting OutputGuardrail singleton."""
    guardrail = _component_registry.get("output_guardrail")
    if guardrail is None:
        from core_ai.guardrails.output_guardrail import OutputGuardrail
        guardrail = OutputGuardrail()
        register_component("output_guardrail", guardrail)
    return guardrail


def get_ingestion_worker() -> Any:
    """Dependency for injecting IngestionWorker singleton."""
    worker = _component_registry.get("ingestion_worker")
    if worker is None:
        from core_ai.ingestion.worker import IngestionWorker
        worker = IngestionWorker(settings=_runtime_settings())
        register_component("ingestion_worker", worker)
    return worker
