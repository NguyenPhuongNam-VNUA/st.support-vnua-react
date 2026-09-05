"""Health check routes for liveness and readiness probes.

GET /health/live: Confirms application process is responsive.
GET /health/ready: Confirms connectivity to PostgreSQL and Redis (degraded-safe).
"""

from datetime import datetime, timezone
from typing import Any, Dict

from fastapi import APIRouter, Response, status

from core_ai.config import get_settings
from core_ai.dependencies import get_component

router = APIRouter(tags=["Health"])


@router.get("/health/live", summary="Liveness Probe")
async def liveness_probe() -> Dict[str, Any]:
    """Kubernetes liveness probe / Docker healthcheck."""
    return {
        "status": "alive",
        "service": "st-care-core-ai",
        "version": "0.1.0",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/health/ready", summary="Readiness Probe")
async def readiness_probe(response: Response) -> Dict[str, Any]:
    """Kubernetes readiness probe checking Database, Redis, and Embedding components.

    Degraded-safe: If Redis is unavailable, returns HTTP 200 with status='degraded'.
    If primary Database connection fails, returns HTTP 503 with status='unhealthy'.
    """
    from core_ai.data.postgres import check_db_health
    from core_ai.data.redis import check_redis_health

    embedding_service = get_component("embedding_service")
    prompt_guard = get_component("prompt_guard_model")
    reranker = get_component("local_reranker")
    settings = get_settings()

    db_status = "unconfigured"
    redis_status = "unconfigured"
    is_ready = True
    is_degraded = False

    if await check_db_health():
        db_status = "healthy"
    else:
        db_status = "unhealthy"
        is_ready = False

    # Check Redis Client
    if await check_redis_health():
        redis_status = "healthy"
    else:
        redis_status = "unavailable (degraded mode active)"
        is_degraded = True

    embedding_credentials = bool(settings.embedding_api_key)
    embedding_status = (
        "configured"
        if embedding_service is not None and embedding_credentials
        else "credentials_missing"
        if embedding_service is not None
        else "unavailable"
    )
    if embedding_service is None or not embedding_credentials:
        is_ready = False

    # Determine overall status
    if not is_ready:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        overall_status = "unhealthy"
    elif is_degraded:
        overall_status = "degraded"
    else:
        overall_status = "ready"

    return {
        "status": overall_status,
        "database": db_status,
        "redis": redis_status,
        "embedding": embedding_status,
        "embedding_model": settings.embedding_model,
        "embedding_dimension": settings.embedding_dimension,
        "local_models": {
            "backend": settings.local_models_backend,
            "prompt_guard": "ready"
            if getattr(prompt_guard, "available", False)
            else "regex_fallback",
            "reranker": "ready" if getattr(reranker, "available", False) else "rrf_fallback",
        },
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
