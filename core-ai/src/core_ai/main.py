"""FastAPI application entrypoint for ST-Care Core AI microservice.

Configures application lifespan, global exception handlers, middleware stack,
and registers chat, documents, and health routers.
"""

from contextlib import asynccontextmanager
import asyncio
import logging
from typing import AsyncGenerator, Optional

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
import uvicorn

from core_ai.api.middleware.auth import InternalAuthMiddleware
from core_ai.api.middleware.body_limit import RequestBodyLimitMiddleware
from core_ai.api.middleware.request_context import RequestContextMiddleware
from core_ai.api.routes.chat import router as chat_router
from core_ai.api.routes.documents import router as documents_router
from core_ai.api.routes.health import router as health_router
from core_ai.config import Settings, get_settings
from core_ai.contracts.errors import CoreAIError, ErrorCode
from core_ai.observability.metrics import metrics_router, record_request_duration
from core_ai.observability.tracer import setup_tracing

# Configure structured root logger
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] [%(name)s] %(message)s",
)
logger = logging.getLogger("core_ai.main")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan context managing startup warm-up and graceful shutdown."""
    settings = getattr(app.state, "settings", None) or get_settings()
    logger.info("Initializing ST-Care Core AI Microservice...")
    logger.info("Environment: %s | Default Tenant: %s", settings.app_env, settings.default_tenant)
    logger.info("Configured LLM Provider: %s | Model: %s", settings.llm_provider, settings.llm_model)
    setup_tracing(
        service_name=settings.otel_service_name,
        otlp_endpoint=settings.otel_exporter_otlp_endpoint,
        app_env=settings.app_env,
    )
    from core_ai.mcp.server import get_mcp_server

    mcp_session_context = get_mcp_server().session_manager.run()
    await mcp_session_context.__aenter__()

    from core_ai.dependencies import get_component, register_component
    register_component("settings", settings)

    # 1. Safe connection pool warm-up
    if get_component("db_pool") is None:
        try:
            from core_ai.data.postgres import init_db_pool
            await init_db_pool(settings)
        except Exception as exc:
            logger.warning("PostgreSQL connection pool initialization bypassed/failed: %s", exc)

    if get_component("redis_client") is None:
        try:
            from core_ai.data.redis import init_redis_client
            await init_redis_client(settings)
        except Exception as exc:
            logger.warning("Redis client initialization bypassed/failed: %s", exc)

    # 2. Eagerly call and wire singletons into the registry
    eager_components = [
        "db_pool",
        "redis_client",
        "llm_port",
        "mcp_gateway",
        "hybrid_retriever",
        "semantic_cache",
        "input_guardrail",
        "prompt_guard_model",
        "local_reranker",
        "output_guardrail",
        "ingestion_worker",
        "graph_runner",
    ]
    for comp_name in eager_components:
        try:
            instance = get_component(comp_name)
            if instance is not None:
                register_component(comp_name, instance)
                logger.info("Eagerly wired singleton '%s' into container.", comp_name)
        except Exception as exc:
            logger.warning("Safe fallback: could not eagerly wire '%s': %s", comp_name, exc)

    # Load optional local weights before readiness. Missing weights keep deterministic fallbacks active.
    for model_name in ("prompt_guard_model", "local_reranker"):
        model_component = get_component(model_name)
        if model_component is not None and hasattr(model_component, "load"):
            try:
                await asyncio.to_thread(model_component.load)
            except Exception as exc:
                logger.warning("Local model '%s' warm-up failed safely: %s", model_name, type(exc).__name__)

    try:
        yield
    finally:
        logger.info("Shutting down ST-Care Core AI Microservice...")
        try:
            from core_ai.data.postgres import close_db_pool
            await close_db_pool()
        except Exception as exc:
            logger.warning("Error closing PostgreSQL pool: %s", exc)

        try:
            from core_ai.data.redis import close_redis_client
            await close_redis_client()
        except Exception as exc:
            logger.warning("Error closing Redis client: %s", exc)

        mcp_gateway = get_component("mcp_gateway")
        if mcp_gateway is not None:
            try:
                await mcp_gateway.close()
            except Exception as exc:
                logger.warning("Error closing MCP gateway: %s", exc)
        await mcp_session_context.__aexit__(None, None, None)


def create_app(settings: Optional[Settings] = None) -> FastAPI:
    """Application factory constructing the FastAPI instance with all middlewares and routers."""
    settings = settings or get_settings()

    app = FastAPI(
        title="ST-Care Core AI Microservice",
        description="RAG, LangGraph orchestration, LLM gateway, MCP tools, and semantic cache for VNUA",
        version="0.1.0",
        lifespan=lifespan,
    )
    app.state.settings = settings

    # Middleware is executed in reverse registration order. Authentication stays
    # outside body buffering/context parsing for cheap rejection of untrusted calls.
    app.add_middleware(RequestContextMiddleware, settings=settings)
    app.add_middleware(RequestBodyLimitMiddleware, settings=settings)
    app.add_middleware(InternalAuthMiddleware, settings=settings)

    from core_ai.dependencies import get_app_settings

    app.dependency_overrides[get_app_settings] = lambda: settings

    @app.middleware("http")
    async def prometheus_request_metrics(request: Request, call_next):
        import time

        started = time.perf_counter()
        response = await call_next(request)
        record_request_duration(
            route=request.url.path,
            status=str(response.status_code),
            duration_seconds=time.perf_counter() - started,
            tenant_id=getattr(request.state, "tenant_id", settings.default_tenant),
            method=request.method,
        )
        return response

    # 4. Global Exception Handlers
    @app.exception_handler(CoreAIError)
    async def core_ai_error_handler(request: Request, exc: CoreAIError) -> JSONResponse:
        logger.warning("CoreAIError caught [%s]: %s", exc.code.value, exc.message)
        return JSONResponse(
            status_code=exc.status_code,
            content=exc.to_dict(),
        )

    @app.exception_handler(RequestValidationError)
    async def validation_error_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
        logger.info("Validation error on %s: %s", request.url.path, exc.errors())
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={
                "error_code": ErrorCode.INVALID_PAYLOAD.value,
                "message": "Dữ liệu yêu cầu không hợp lệ hoặc thiếu trường bắt buộc",
                "details": exc.errors(),
                "retryable": False,
            },
        )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        logger.error(
            "Unhandled exception on %s: %s",
            request.url.path,
            type(exc).__name__,
            exc_info=True,
        )
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "error_code": ErrorCode.INTERNAL_ERROR.value,
                "message": "Lỗi máy chủ nội bộ không mong muốn",
                "retryable": True,
            },
        )

    # 5. Include API Routers
    app.include_router(health_router)
    app.include_router(chat_router)
    app.include_router(documents_router)
    app.include_router(metrics_router)

    from core_ai.mcp.server import get_mcp_asgi_app

    app.mount("/", get_mcp_asgi_app(settings))
    FastAPIInstrumentor.instrument_app(app)

    return app


app = create_app()


if __name__ == "__main__":
    current_settings = get_settings()
    uvicorn.run(
        "core_ai.main:app",
        host=current_settings.core_ai_host,
        port=current_settings.core_ai_port,
        reload=current_settings.app_env.lower() == "development",
    )
