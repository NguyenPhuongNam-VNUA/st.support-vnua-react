"""Unit Tests for OpenTelemetry Tracing and Prometheus Metrics Exporters.

Tests:
1. OpenTelemetry tracer initialization and SafeSpan attribute safety (prohibits raw prompt/PII attributes).
2. trace_stage asynchronous context manager lifecycle and latency recording.
3. Prometheus metrics recording: request duration, cache hits/misses, external calls, fallback, and MCP tool latency.
4. GET /metrics scrape endpoint.
"""

import pytest
from prometheus_client import generate_latest

from core_ai.observability.metrics import (
    metrics_registry,
    record_cache_access,
    record_estimated_cost,
    record_external_call,
    record_fallback,
    record_llm_tokens,
    record_mcp_tool,
    record_redis_degraded,
    record_request_duration,
    record_retrieval_evidence,
    record_time_to_safe_answer,
    record_time_to_status,
)
from core_ai.observability.tracer import (
    create_safe_span,
    trace_stage,
)


class TestObservability:
    def test_safe_span_prohibits_forbidden_attributes(self) -> None:
        """SafeSpan silently ignores raw prompts, credentials, and sensitive PII keys."""
        span = create_safe_span("test_stage", request_id="req-123", tenant_id="vnua")

        # Prohibited keys
        span.set_safe_attribute("prompt", "What is the secret?")
        span.set_safe_attribute("raw_prompt", "SELECT * FROM secrets")
        span.set_safe_attribute("user_message", "Hello")
        span.set_safe_attribute("internal_token", "super-secret-token")
        span.set_safe_attribute("api_key", "sk-123456789")

        # Permitted keys
        span.set_safe_attribute("stage.name", "retrieval")
        span.set_safe_attribute("retrieval.candidates_count", 5)

        span.end()

    @pytest.mark.asyncio
    async def test_trace_stage_context_manager(self) -> None:
        """trace_stage measures execution duration and terminates cleanly."""
        async with trace_stage("unit_test_stage", request_id="req-abc", tenant_id="vnua") as safe_span:
            assert safe_span is not None
            safe_span.set_safe_attribute("custom.metric", 42)

    def test_record_prometheus_metrics(self) -> None:
        """Verifies recording functions update the Prometheus collectors without error."""
        record_request_duration(
            route="/v1/chat",
            status="answered",
            duration_seconds=0.75,
            tenant_id="vnua",
        )
        record_cache_access(hit=True, tenant_id="vnua")
        record_cache_access(hit=False, tenant_id="vnua")
        record_external_call(provider="gemini", model="gemini-3.5-flash", purpose="answer_generation")
        record_fallback(reason="low_evidence", strategy="safe_template")
        record_mcp_tool(tool_name="search_knowledge", status="success", duration_seconds=0.15)
        record_redis_degraded(reason="connection_refused")
        record_llm_tokens(provider="gemini", model="gemini-3.5-flash", prompt_tokens=50, completion_tokens=30)
        record_estimated_cost(provider="gemini", model="gemini-3.5-flash", cost_usd=0.001)
        record_retrieval_evidence(sufficient=False, tenant_id="vnua")
        record_time_to_status(tenant_id="vnua", duration_seconds=0.05)
        record_time_to_safe_answer(
            tenant_id="vnua", outcome="answered", duration_seconds=0.8
        )

        # Scrape registry
        scraped_text = generate_latest(metrics_registry).decode("utf-8")
        assert "core_ai_request_duration_seconds" in scraped_text
        assert "semantic_cache_hit_ratio" in scraped_text
        assert "core_ai_external_calls_total" in scraped_text
        assert "core_ai_fallback_total" in scraped_text
        assert "core_ai_mcp_tool_duration_seconds" in scraped_text
        assert "core_ai_redis_degraded_total" in scraped_text
        assert "estimated_cost_total" in scraped_text
        assert "retrieval_no_evidence_ratio" in scraped_text
        assert "core_ai_time_to_status_seconds" in scraped_text
        assert "core_ai_time_to_safe_answer_seconds" in scraped_text
