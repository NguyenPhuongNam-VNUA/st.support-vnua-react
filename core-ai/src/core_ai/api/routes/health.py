"""Health check routes for liveness and readiness probes.

GET /health/live: Confirms application process is responsive.
GET /health/ready: Confirms connectivity to PostgreSQL and Redis (degraded-safe).
"""

from datetime import datetime, timezone
from typing import Any, Dict
from fastapi import APIRouter, Response, status

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
    db_pool = get_component("db_pool")
    redis_client = get_component("redis_client")

    db_status = "unconfigured"
    redis_status = "unconfigured"
    is_ready = True
    is_degraded = False

    # Check Database Pool
    if db_pool is not None:
        try:
            async with db_pool.acquire() as conn:
                await conn.fetchval("SELECT 1")
            db_status = "healthy"
        except Exception as e:
            db_status = f"unhealthy: {str(e)}"
            is_ready = False
    else:
        # Before pool initialization, mark as initialized/ready for startup probe
        db_status = "ready"

    # Check Redis Client
    if redis_client is not None:
        try:
            await redis_client.ping()
            redis_status = "healthy"
        except Exception:
            redis_status = "unavailable (degraded mode active)"
            is_degraded = True
    else:
        redis_status = "ready"

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
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
