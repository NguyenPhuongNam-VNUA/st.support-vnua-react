"""Prometheus Metrics Exporter for ST-Care Core AI microservice.

Collects real-time operational telemetry across all pipeline stages:
- Request latency and throughput
- Semantic cache hit/miss rates
- External LLM call counts and token consumption
- MCP tool execution latency
- Resilience and degradation events (Redis down, provider failover)
"""

import logging
from typing import Dict, Optional
from fastapi import APIRouter, Response
from prometheus_client import (
    CONTENT_TYPE_LATEST,
    CollectorRegistry,
    Counter,
    Gauge,
    Histogram,
    generate_latest,
)

logger = logging.getLogger("core_ai.observability.metrics")

# Use a dedicated or default registry
metrics_registry = CollectorRegistry(auto_describe=True)

# 1. Request Duration Histogram
# Plan §12: core_ai_request_duration_seconds by route and status
REQUEST_DURATION_SECONDS = Histogram(
    "core_ai_request_duration_seconds",
    "End-to-end request latency in seconds",
    ["route", "status", "tenant_id"],
    buckets=[0.05, 0.1, 0.25, 0.5, 0.75, 1.0, 1.5, 2.0, 3.0, 5.0, 10.0, 20.0],
    registry=metrics_registry,
)

# 2. Total Requests Counter
REQUESTS_TOTAL = Counter(
    "core_ai_requests_total",
    "Total number of received requests",
    ["route", "method", "status"],
    registry=metrics_registry,
)

# 3. External AI Calls Counter
# Plan §12: core_ai_external_calls_total
EXTERNAL_CALLS_TOTAL = Counter(
    "core_ai_external_calls_total",
    "Total number of external AI model/API invocations (strictly max 2 per request)",
    ["provider", "model", "purpose"],
    registry=metrics_registry,
)

# 4. Fallback Counter
# Plan §12: fallback_total
FALLBACK_TOTAL = Counter(
    "core_ai_fallback_total",
    "Total count of fallback activations due to low evidence, provider error, or budget exhaustion",
    ["reason", "strategy"],
    registry=metrics_registry,
)

# 5. MCP Tool Duration Histogram
# Plan §12: mcp_tool_duration_seconds
MCP_TOOL_DURATION_SECONDS = Histogram(
    "core_ai_mcp_tool_duration_seconds",
    "Execution duration of MCP tool calls in seconds",
    ["tool_name", "status"],
    buckets=[0.05, 0.1, 0.25, 0.5, 1.0, 2.0, 3.0, 5.0],
    registry=metrics_registry,
)

# 6. Redis Degradation Counter
# Plan §12: redis_degraded_total
REDIS_DEGRADED_TOTAL = Counter(
    "core_ai_redis_degraded_total",
    "Total count of operations executed in Redis degraded mode (cache bypass)",
    ["reason"],
    registry=metrics_registry,
)

# 7. Semantic Cache Hits, Misses & Ratio
CACHE_REQUESTS_TOTAL = Counter(
    "core_ai_semantic_cache_requests_total",
    "Total semantic cache lookups",
    ["tenant_id", "result"],  # result: 'hit', 'miss', 'bypassed'
    registry=metrics_registry,
)

CACHE_HIT_RATIO = Gauge(
    "semantic_cache_hit_ratio",
    "Instantaneous ratio of semantic cache hits over total lookups",
    ["tenant_id"],
    registry=metrics_registry,
)

# 8. Token Accounting
LLM_TOKENS_TOTAL = Counter(
    "core_ai_llm_tokens_total",
    "Total LLM tokens consumed",
    ["provider", "model", "token_type"],  # prompt, completion
    registry=metrics_registry,
)

ESTIMATED_COST_TOTAL = Counter(
    "estimated_cost_total",
    "Estimated external model cost in USD as reported by the provider adapter",
    ["provider", "model"],
    registry=metrics_registry,
)

TIME_TO_STATUS_SECONDS = Histogram(
    "core_ai_time_to_status_seconds",
    "Time from request start until the first safe pipeline status event",
    ["tenant_id"],
    buckets=[0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.0, 5.0],
    registry=metrics_registry,
)

TIME_TO_SAFE_ANSWER_SECONDS = Histogram(
    "core_ai_time_to_safe_answer_seconds",
    "Time from request start until a guarded answer or safe error is emitted",
    ["tenant_id", "outcome"],
    buckets=[0.1, 0.25, 0.5, 0.75, 1.0, 1.5, 2.0, 3.0, 5.0, 10.0, 20.0],
    registry=metrics_registry,
)

# 9. Database Connection Pool Gauge
DB_POOL_IN_USE = Gauge(
    "core_ai_db_pool_in_use",
    "Current number of active asyncpg database connections acquired from Supavisor pool",
    ["pool_name"],
    registry=metrics_registry,
)

# 10. Retrieval Without Evidence Counter
RETRIEVAL_NO_EVIDENCE_TOTAL = Counter(
    "core_ai_retrieval_no_evidence_total",
    "Total queries where retrieval returned zero or sub-threshold evidence snippets",
    ["tenant_id"],
    registry=metrics_registry,
)

RETRIEVAL_NO_EVIDENCE_RATIO = Gauge(
    "retrieval_no_evidence_ratio",
    "Process-local ratio of evaluated retrievals without sufficient evidence",
    ["tenant_id"],
    registry=metrics_registry,
)

# Internal tracking for cache ratio computation
_cache_stats: Dict[str, Dict[str, int]] = {}
_retrieval_stats: Dict[str, Dict[str, int]] = {}


def record_request_duration(
    route: str,
    status: str,
    duration_seconds: float,
    tenant_id: str = "vnua",
    method: str = "POST",
) -> None:
    """Records completion latency of a request."""
    REQUEST_DURATION_SECONDS.labels(
        route=route,
        status=status,
        tenant_id=tenant_id,
    ).observe(duration_seconds)
    REQUESTS_TOTAL.labels(
        route=route,
        method=method,
        status=status,
    ).inc()


def record_cache_access(
    hit: bool,
    tenant_id: str = "vnua",
    bypassed: bool = False,
) -> None:
    """Records a semantic cache lookup and updates the hit ratio gauge."""
    if bypassed:
        result = "bypassed"
    elif hit:
        result = "hit"
    else:
        result = "miss"

    CACHE_REQUESTS_TOTAL.labels(tenant_id=tenant_id, result=result).inc()

    # Track in-memory stats to update ratio gauge
    if tenant_id not in _cache_stats:
        _cache_stats[tenant_id] = {"hits": 0, "total": 0}

    if not bypassed:
        _cache_stats[tenant_id]["total"] += 1
        if hit:
            _cache_stats[tenant_id]["hits"] += 1

        total = _cache_stats[tenant_id]["total"]
        hits = _cache_stats[tenant_id]["hits"]
        ratio = round(hits / total, 4) if total > 0 else 0.0
        CACHE_HIT_RATIO.labels(tenant_id=tenant_id).set(ratio)


def record_external_call(
    provider: str,
    model: str,
    purpose: str = "answer_generation",
) -> None:
    """Records an external model API call."""
    EXTERNAL_CALLS_TOTAL.labels(
        provider=provider,
        model=model,
        purpose=purpose,
    ).inc()


def record_fallback(
    reason: str,
    strategy: str = "safe_template",
) -> None:
    """Records a fallback activation event."""
    FALLBACK_TOTAL.labels(
        reason=reason,
        strategy=strategy,
    ).inc()


def record_mcp_tool(
    tool_name: str,
    status: str,
    duration_seconds: float,
) -> None:
    """Records duration and outcome status of an MCP tool invocation."""
    MCP_TOOL_DURATION_SECONDS.labels(
        tool_name=tool_name,
        status=status,
    ).observe(duration_seconds)


def record_redis_degraded(reason: str = "connection_failed") -> None:
    """Records a Redis degraded incident."""
    REDIS_DEGRADED_TOTAL.labels(reason=reason).inc()


def record_llm_tokens(
    provider: str,
    model: str,
    prompt_tokens: int,
    completion_tokens: int,
) -> None:
    """Records token consumption metrics."""
    if prompt_tokens > 0:
        LLM_TOKENS_TOTAL.labels(
            provider=provider,
            model=model,
            token_type="prompt",
        ).inc(prompt_tokens)
    if completion_tokens > 0:
        LLM_TOKENS_TOTAL.labels(
            provider=provider,
            model=model,
            token_type="completion",
        ).inc(completion_tokens)


def record_estimated_cost(provider: str, model: str, cost_usd: Optional[float]) -> None:
    """Adds a non-negative provider-reported cost estimate when available."""
    if cost_usd is not None and cost_usd >= 0:
        ESTIMATED_COST_TOTAL.labels(provider=provider, model=model).inc(cost_usd)


def record_time_to_status(tenant_id: str, duration_seconds: float) -> None:
    TIME_TO_STATUS_SECONDS.labels(tenant_id=tenant_id).observe(max(0.0, duration_seconds))


def record_time_to_safe_answer(
    tenant_id: str, outcome: str, duration_seconds: float
) -> None:
    TIME_TO_SAFE_ANSWER_SECONDS.labels(
        tenant_id=tenant_id,
        outcome=outcome,
    ).observe(max(0.0, duration_seconds))


def record_db_pool_usage(in_use: int, pool_name: str = "supavisor") -> None:
    """Updates the active DB connection pool gauge."""
    DB_POOL_IN_USE.labels(pool_name=pool_name).set(in_use)


def record_retrieval_evidence(sufficient: bool, tenant_id: str = "vnua") -> None:
    """Records every evidence evaluation and updates its no-evidence ratio."""
    stats = _retrieval_stats.setdefault(tenant_id, {"total": 0, "no_evidence": 0})
    stats["total"] += 1
    if not sufficient:
        stats["no_evidence"] += 1
        RETRIEVAL_NO_EVIDENCE_TOTAL.labels(tenant_id=tenant_id).inc()
    RETRIEVAL_NO_EVIDENCE_RATIO.labels(tenant_id=tenant_id).set(
        stats["no_evidence"] / stats["total"]
    )


def record_no_evidence(tenant_id: str = "vnua") -> None:
    """Compatibility wrapper for callers that only report failed evidence."""
    record_retrieval_evidence(False, tenant_id)


# Prometheus Scrape Route
metrics_router = APIRouter(tags=["Observability"])


@metrics_router.get("/metrics", summary="Prometheus Metrics Endpoint")
async def metrics_endpoint() -> Response:
    """Exposes current Prometheus metrics in standard text format for scraping."""
    output = generate_latest(metrics_registry)
    return Response(content=output, media_type=CONTENT_TYPE_LATEST)
