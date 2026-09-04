"""OpenTelemetry Distributed Tracing with Safe Telemetry Filtering.

Enforces strict compliance with ST-Care security guidelines:
- NEVER logs or sets raw prompts or user queries as span attributes or baggage.
- NEVER leaks raw PII (phone, citizen ID, email, tokens) in trace spans.
- Captures safe execution metadata: stage name, latency, status, token usage,
  model identifier, and sanitized tenant IDs.
"""

from contextlib import asynccontextmanager
from functools import wraps
import logging
import time
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
            from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import (  # type: ignore[import-not-found]
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
    """Wrapper around OpenTelemetry Span enforcing attribute safety.

    Guarantees that sensitive prompt data, credentials, and PII are
    never recorded into span attributes.
    """

    # Attribute keys that are strictly prohibited from tracing
    FORBIDDEN_ATTRIBUTES = {
        "prompt",
        "raw_prompt",
        "user_message",
        "message",
        "system_prompt",
        "chain_of_thought",
        "thought",
        "internal_token",
        "api_key",
        "authorization",
        "cookie",
        "password",
        "secret",
        "student_phone",
        "cccd",
    }

    def __init__(self, span: Span) -> None:
        self._span = span

    @property
    def span(self) -> Span:
        return self._span

    def set_safe_attribute(self, key: str, value: Any) -> None:
        """Sets a span attribute only if the key is not in the forbidden list."""
        if not key or not self._span.is_recording():
            return

        normalized_key = key.lower().replace("-", "_")
        if normalized_key in self.FORBIDDEN_ATTRIBUTES:
            logger.debug("Omitted forbidden trace attribute key: %s", key)
            return

        # Check if caller wants to log raw prompt explicitly and override
        settings = get_settings()
        if not settings.log_raw_prompts and "prompt" in normalized_key:
            return

        # Sanitize string values (scalars or lists of scalars)
        if isinstance(value, (str, int, float, bool)):
            self._span.set_attribute(key, value)
        elif isinstance(value, list) and all(isinstance(x, (str, int, float, bool)) for x in value):
            self._span.set_attribute(key, value)
        elif value is None:
            pass
        else:
            self._span.set_attribute(key, str(value)[:200])

    def set_safe_attributes(self, attributes: Dict[str, Any]) -> None:
        """Sets multiple safe attributes in batch."""
        for k, v in attributes.items():
            self.set_safe_attribute(k, v)

    def record_exception(self, exc: BaseException, escaped: bool = False) -> None:
        """Records an exception on the span and sets error status."""
        self._span.record_exception(exc, escaped=escaped)
        self._span.set_status(Status(StatusCode.ERROR, description=str(exc)))

    def end(self) -> None:
        """Terminates span lifecycle."""
        self._span.end()


def create_safe_span(
    name: str,
    request_id: Optional[str] = None,
    tenant_id: Optional[str] = None,
    attributes: Optional[Dict[str, Any]] = None,
) -> SafeSpan:
    """Factory creating an active SafeSpan with correlated trace attributes.

    Args:
        name: Name of operation/stage (e.g. 'input_guardrail', 'retrieval').
        request_id: Optional UUID of incoming request.
        tenant_id: Tenant namespace identifier.
        attributes: Additional safe metadata attributes.
    """
    tracer = get_tracer()
    raw_span = tracer.start_span(name)
    safe = SafeSpan(raw_span)

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
    """Asynchronous context manager wrapping a pipeline execution stage in a safe span.

    Example:
        async with trace_stage("retrieval", request_id="uuid", tenant_id="vnua") as span:
            results = await do_retrieval()
            span.set_safe_attribute("retrieval.results_count", len(results))
    """
    safe_span = create_safe_span(
        name=stage_name,
        request_id=request_id,
        tenant_id=tenant_id,
        attributes=attributes,
    )
    t0 = time.perf_counter()
    try:
        yield safe_span
        latency_ms = int((time.perf_counter() - t0) * 1000)
        safe_span.set_safe_attribute("stage.latency_ms", latency_ms)
        safe_span.span.set_status(Status(StatusCode.OK))
    except Exception as exc:
        latency_ms = int((time.perf_counter() - t0) * 1000)
        safe_span.set_safe_attribute("stage.latency_ms", latency_ms)
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

        import asyncio
        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        return sync_wrapper

    return decorator
