"""Observability package for ST-Care Core AI microservice.

Provides OpenTelemetry distributed tracing, safe execution telemetry,
and Prometheus metrics collection.
"""

from core_ai.observability.metrics import (
    metrics_registry,
    metrics_router,
    record_cache_access,
    record_external_call,
    record_fallback,
    record_llm_tokens,
    record_mcp_tool,
    record_redis_degraded,
    record_request_duration,
)
from core_ai.observability.tracer import (
    SafeSpan,
    create_safe_span,
    get_tracer,
    setup_tracing,
    trace_stage,
)

__all__ = [
    "metrics_registry",
    "metrics_router",
    "record_request_duration",
    "record_cache_access",
    "record_external_call",
    "record_fallback",
    "record_mcp_tool",
    "record_redis_degraded",
    "record_llm_tokens",
    "get_tracer",
    "setup_tracing",
    "trace_stage",
    "create_safe_span",
    "SafeSpan",
]
