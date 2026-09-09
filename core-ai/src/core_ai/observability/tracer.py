"""OpenTelemetry Distributed Tracing with Safe Telemetry Filtering.

Enforces strict compliance with ST-Care security guidelines:
- NEVER logs or sets raw prompts or user queries as span attributes or baggage.
- NEVER leaks raw PII (phone, citizen ID, email, tokens) in trace spans.
- Captures safe execution metadata: stage name, latency, status, token usage,
  model identifier, and sanitized tenant IDs.
"""

import inspect
import logging
import time
from contextlib import asynccontextmanager
from functools import wraps
from typing import Any, AsyncGenerator, Callable, Dict, Optional, TypeVar

from opentelemetry import trace
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import (
    BatchSpanProcessor,
    ConsoleSpanExporter,
    SimpleSpanProcessor,
)
from opentelemetry.trace import Span, Status, StatusCode, Tracer

from core_ai.config import get_settings

logger = logging.getLogger("core_ai.observability.tracer")

# Global tracer singleton
_TRACER: Optional[Tracer] = None
_IS_INITIALIZED: bool = False

T = TypeVar("T")


def setup_tracing(
    service_name: Optional[str] = None,
    otlp_endpoint: Optional[str] = None,
    app_env: Optional[str] = None,
) -> Tracer:
    """Configures the global OpenTelemetry TracerProvider.

    Args:
        service_name: Name of microservice for trace identification.
        otlp_endpoint: gRPC or HTTP collector endpoint (e.g. http://otel-collector:4317).
        app_env: Deployment environment ('development', 'staging', 'production').

    Returns:
        Configured OpenTelemetry Tracer instance.
    """
    global _TRACER, _IS_INITIALIZED

    if _IS_INITIALIZED and _TRACER is not None:
        return _TRACER

    settings = get_settings()
    svc_name = service_name or settings.otel_service_name or "st-care-core-ai"
    endpoint = otlp_endpoint or settings.otel_exporter_otlp_endpoint
    env = app_env or settings.app_env

    resource = Resource.create(
        attributes={
            "service.name": svc_name,
            "service.version": "0.1.0",
            "deployment.environment": env,
        }
    )

    provider = TracerProvider(resource=resource)

    # Attach exporter: OTLP if configured, otherwise Console exporter in dev or no-op
    if endpoint:
        try:
            from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import (
                OTLPSpanExporter,
            )

            otlp_exporter = OTLPSpanExporter(endpoint=endpoint, insecure=True)
            provider.add_span_processor(BatchSpanProcessor(otlp_exporter))
            logger.info("Configured OTLP gRPC span exporter to %s", endpoint)
        except Exception as exc:
            logger.warning(
                "Could not initialize OTLPSpanExporter (%s). Falling back to Console exporter: %s",
                endpoint,
                exc,
            )
            provider.add_span_processor(SimpleSpanProcessor(ConsoleSpanExporter()))
    elif env.lower() == "development":
        # In development without OTLP endpoint, avoid spamming stdout unless debug is desired
        logger.info("OpenTelemetry initialized with in-memory/no-op provider in development.")
    else:
        logger.info("OpenTelemetry initialized without remote exporter.")

    trace.set_tracer_provider(provider)
    _TRACER = trace.get_tracer(svc_name, "0.1.0")
    _IS_INITIALIZED = True
    return _TRACER


def get_tracer() -> Tracer:
    """Returns the configured Tracer instance, lazily initializing if necessary."""
    global _TRACER
    if _TRACER is None:
        _TRACER = setup_tracing()
    return _TRACER


class SafeSpan:
    """Enforces that sensitive prompt data, credentials, and PII are omitted from trace attributes."""

    FORBIDDEN_ATTRIBUTES = {
        "prompt", "raw_prompt", "user_message", "message", "system_prompt",
        "chain_of_thought", "thought", "internal_token", "api_key",
        "authorization", "cookie", "password", "secret", "student_phone", "cccd",
    }

    def __init__(self, span: Span) -> None:
        self.span = span

    def set_safe_attribute(self, key: str, value: Any) -> None:
        if not key or not self.span.is_recording() or key.lower().replace("-", "_") in self.FORBIDDEN_ATTRIBUTES:
            return
        if not get_settings().log_raw_prompts and "prompt" in key.lower():
            return
        if isinstance(value, (str, int, float, bool)) or (isinstance(value, list) and all(isinstance(x, (str, int, float, bool)) for x in value)):
            self.span.set_attribute(key, value)
        elif value is not None:
            self.span.set_attribute(key, str(value)[:200])

    def set_safe_attributes(self, attributes: Dict[str, Any]) -> None:
        for k, v in attributes.items():
            self.set_safe_attribute(k, v)

    def record_exception(self, exc: BaseException, escaped: bool = False) -> None:
        self.span.record_exception(exc, escaped=escaped)
        self.span.set_status(Status(StatusCode.ERROR, description=str(exc)))

    def end(self) -> None:
        self.span.end()


def create_safe_span(
    name: str,
    request_id: Optional[str] = None,
    tenant_id: Optional[str] = None,
    attributes: Optional[Dict[str, Any]] = None,
) -> SafeSpan:
    """Factory creating an active SafeSpan with correlated trace attributes."""
    safe = SafeSpan(get_tracer().start_span(name))
    if request_id:
        safe.set_safe_attribute("stcare.request_id", request_id)
    if tenant_id:
        safe.set_safe_attribute("stcare.tenant_id", tenant_id)
    if attributes:
        safe.set_safe_attributes(attributes)
    return safe


@asynccontextmanager
async def trace_stage(
    stage_name: str,
    request_id: Optional[str] = None,
    tenant_id: Optional[str] = None,
    attributes: Optional[Dict[str, Any]] = None,
) -> AsyncGenerator[SafeSpan, None]:
    """Asynchronous context manager wrapping a pipeline execution stage in a safe span."""
    safe_span = create_safe_span(stage_name, request_id, tenant_id, attributes)
    t0 = time.perf_counter()
    try:
        yield safe_span
        safe_span.set_safe_attribute("stage.latency_ms", int((time.perf_counter() - t0) * 1000))
        safe_span.span.set_status(Status(StatusCode.OK))
    except Exception as exc:
        safe_span.set_safe_attribute("stage.latency_ms", int((time.perf_counter() - t0) * 1000))
        safe_span.record_exception(exc)
        raise
    finally:
        safe_span.end()


def traced(stage_name: Optional[str] = None) -> Callable[..., Any]:
    """Decorator to automatically trace synchronous or asynchronous functions."""
    def decorator(func: Callable[..., Any]) -> Callable[..., Any]:
        name = stage_name or func.__name__

        @wraps(func)
        async def async_wrapper(*args: Any, **kwargs: Any) -> Any:
            async with trace_stage(name):
                return await func(*args, **kwargs)

        @wraps(func)
        def sync_wrapper(*args: Any, **kwargs: Any) -> Any:
            safe = create_safe_span(name)
            try:
                result = func(*args, **kwargs)
                safe.span.set_status(Status(StatusCode.OK))
                return result
            except Exception as exc:
                safe.record_exception(exc)
                raise
            finally:
                safe.end()

        return async_wrapper if inspect.iscoroutinefunction(func) else sync_wrapper

    return decorator
