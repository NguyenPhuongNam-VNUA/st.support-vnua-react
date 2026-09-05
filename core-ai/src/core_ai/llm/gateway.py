"""LLMGateway implementation conforming to core_ai.contracts.llm.LLMPort.

Features:
- Multi-provider abstraction using LiteLLM (Gemini default gemini-3.5-flash, OpenAI, OpenAI-compatible).
- Strict call budget enforcement (maximum 2 external calls per request).
- 1 permitted failover retry on timeout or 5xx if call budget allows.
- Local structured output validation and JSON repair (zero extra LLM calls).
- Dependency injection singleton registration in core_ai.dependencies.
"""

import logging
from typing import AsyncGenerator, Optional

from core_ai.config import Settings, get_settings
from core_ai.contracts.errors import (
    CallBudgetExceededError,
    ProviderTimeoutError,
    ProviderUnavailableError,
)
from core_ai.contracts.llm import (
    GenerationRequest,
    GenerationResult,
    LLMPort,
    ModelConfig,
    TokenUsage,
)
from core_ai.dependencies import register_component
from core_ai.llm.litellm_adapter import LiteLLMAdapter, get_provider_capabilities
from core_ai.llm.prompts.st_care import (
    get_budget_exceeded_response,
    get_safe_fallback_response,
)
from core_ai.observability.metrics import (
    record_estimated_cost,
    record_external_call,
    record_llm_tokens,
)

logger = logging.getLogger("core_ai.llm.gateway")


class LLMGateway(LLMPort):
    """Production LLM Gateway orchestrating model generation, failover, and budget enforcement."""

    def __init__(
        self,
        settings: Optional[Settings] = None,
        adapter: Optional[LiteLLMAdapter] = None,
        safe_fallback_on_exhaustion: bool = False,
    ) -> None:
        self._settings = settings or get_settings()
        self._adapter = adapter or LiteLLMAdapter()
        self._safe_fallback_on_exhaustion = safe_fallback_on_exhaustion

        # Build primary model config from settings
        provider_name = self._settings.llm_provider.lower()
        model_name = self._settings.llm_model
        capabilities = get_provider_capabilities(provider_name, model_name)

        # Smart API key resolution based on provider
        api_key = self._settings.llm_api_key
        if not api_key:
            import os
            if provider_name == "openai":
                api_key = os.environ.get("OPENAI_API_KEY")
            elif provider_name == "gemini":
                api_key = os.environ.get("GOOGLE_API_KEY") or os.environ.get("GEMINI_API_KEY")
            elif provider_name == "anthropic":
                api_key = os.environ.get("ANTHROPIC_API_KEY")

        self._active_config = ModelConfig(
            provider=provider_name,  # type: ignore[arg-type]
            model=model_name,
            api_key=api_key,
            base_url=self._settings.llm_base_url,
            timeout_seconds=self._settings.llm_timeout_seconds,
            max_external_calls=self._settings.llm_max_external_calls,
            fallback_provider=self._settings.llm_fallback_provider,
            fallback_model=self._settings.llm_fallback_model,
            capabilities=capabilities,
        )

    async def get_active_model_config(self) -> ModelConfig:
        """Returns the currently active model configuration and capability profile."""
        return self._active_config

    def update_config(self, new_config: ModelConfig) -> None:
        """Dynamically updates active configuration (e.g. for testing or hot-reload)."""
        logger.info(
            "Updating LLMGateway config to provider=%s, model=%s",
            new_config.provider,
            new_config.model,
        )
        self._active_config = new_config

    def _create_safe_fallback_result(
        self,
        request: GenerationRequest,
        fallback_text: str,
        reason: str,
        external_calls_used: int = 0,
    ) -> GenerationResult:
        """Constructs a deterministic safe GenerationResult without external calls."""
        return GenerationResult(
            content=fallback_text,
            parsed_json=None,
            structured_output=None,
            usage=TokenUsage(prompt_tokens=0, completion_tokens=0, total_tokens=0),
            tokens=TokenUsage(prompt_tokens=0, completion_tokens=0, total_tokens=0),
            model_name=self._active_config.model,
            model=self._active_config.model,
            provider=self._active_config.provider,
            latency_ms=0,
            external_calls_used=external_calls_used,
            finish_reason="stop",
        )

    async def generate(self, request: GenerationRequest) -> GenerationResult:
        """Executes generation against active provider with timeout, local repair, and budget tracking.

        Call Budget Enforcement:
        - Ceiling: Maximum 2 external AI calls per request.
        - This gateway normally spends 1 answer-generation call.
        - Failover is permitted only while the request-wide budget has capacity.
        - If budget exceeded: raises CallBudgetExceededError (or returns safe fallback if configured).
        """
        # 1. Check budget ceiling before initiating call
        if request.external_calls_already_made >= self._active_config.max_external_calls:
            logger.warning(
                "Call budget exceeded for request_id=%s: already made %d calls (max %d)",
                request.request_id,
                request.external_calls_already_made,
                self._active_config.max_external_calls,
            )
            if self._safe_fallback_on_exhaustion:
                return self._create_safe_fallback_result(
                    request=request,
                    fallback_text=get_budget_exceeded_response(),
                    reason="call_budget_exceeded",
                    external_calls_used=0,
                )
            raise CallBudgetExceededError(
                f"Vượt quá giới hạn cuộc gọi AI bên ngoài (tối đa {self._active_config.max_external_calls} calls). "
                f"Yêu cầu {request.request_id} đã thực hiện {request.external_calls_already_made} calls."
            )

        # 2. First attempt with active configuration
        calls_spent = request.external_calls_already_made
        try:
            logger.info(
                "Executing primary LLM call (call %d/%d) for request_id=%s via %s:%s",
                calls_spent + 1,
                self._active_config.max_external_calls,
                request.request_id,
                self._active_config.provider,
                self._active_config.model,
            )
            record_external_call(
                self._active_config.provider, self._active_config.model, "answer_generation"
            )
            result = await self._adapter.execute(self._active_config, request)
            record_llm_tokens(
                result.provider,
                result.model_name,
                result.usage.prompt_tokens,
                result.usage.completion_tokens,
            )
            record_estimated_cost(
                result.provider, result.model_name, result.usage.estimated_cost_usd
            )
            return result
        except (ProviderTimeoutError, ProviderUnavailableError) as primary_err:
            calls_spent += 1
            logger.warning(
                "Primary LLM call failed for request_id=%s: %s",
                request.request_id,
                primary_err.message,
            )

            # 3. Check if failover retry is permitted within budget
            can_failover = (
                calls_spent < self._active_config.max_external_calls
                and (self._active_config.fallback_provider or self._active_config.fallback_model)
            )

            if not can_failover:
                if calls_spent >= self._active_config.max_external_calls:
                    logger.error(
                        "Cannot failover for request_id=%s: call budget reached (%d/%d)",
                        request.request_id,
                        calls_spent,
                        self._active_config.max_external_calls,
                    )
                if self._safe_fallback_on_exhaustion:
                    return self._create_safe_fallback_result(
                        request=request,
                        fallback_text=get_safe_fallback_response(primary_err.message),
                        reason=primary_err.code.value,
                        external_calls_used=1,
                    )
                raise primary_err

            # 4. Perform 1 failover retry using fallback configuration
            fallback_provider = (
                self._active_config.fallback_provider or self._active_config.provider
            ).lower()
            fallback_model = self._active_config.fallback_model or self._active_config.model
            fallback_caps = get_provider_capabilities(fallback_provider, fallback_model)

            fallback_config = ModelConfig(
                provider=fallback_provider,  # type: ignore[arg-type]
                model=fallback_model,
                api_key=self._active_config.api_key,
                base_url=self._active_config.base_url,
                timeout_seconds=self._active_config.timeout_seconds,
                max_external_calls=self._active_config.max_external_calls,
                capabilities=fallback_caps,
            )

            logger.info(
                "Attempting failover LLM call (call %d/%d) for request_id=%s via %s:%s",
                calls_spent + 1,
                self._active_config.max_external_calls,
                request.request_id,
                fallback_config.provider,
                fallback_config.model,
            )

            try:
                record_external_call(
                    fallback_config.provider, fallback_config.model, "answer_generation_failover"
                )
                failover_result = await self._adapter.execute(fallback_config, request)
                record_llm_tokens(
                    failover_result.provider,
                    failover_result.model_name,
                    failover_result.usage.prompt_tokens,
                    failover_result.usage.completion_tokens,
                )
                record_estimated_cost(
                    failover_result.provider,
                    failover_result.model_name,
                    failover_result.usage.estimated_cost_usd,
                )
                return failover_result.model_copy(update={"external_calls_used": 2})
            except Exception as failover_err:
                logger.error(
                    "Failover LLM call also failed for request_id=%s: %s",
                    request.request_id,
                    type(failover_err).__name__,
                )
                if self._safe_fallback_on_exhaustion:
                    return self._create_safe_fallback_result(
                        request=request,
                        fallback_text=get_safe_fallback_response("provider failover unavailable"),
                        reason="failover_exhausted",
                        external_calls_used=2,
                    )
                raise primary_err from failover_err

    async def generate_stream(
        self,
        request: GenerationRequest,
    ) -> AsyncGenerator[str, None]:
        """Executes streaming completion call against active provider yielding text chunks.

        Enforces budget ceiling prior to stream initialization.
        """
        if request.external_calls_already_made >= self._active_config.max_external_calls:
            raise CallBudgetExceededError(
                f"Vượt quá giới hạn cuộc gọi AI bên ngoài (tối đa {self._active_config.max_external_calls} calls)"
            )

        async for chunk in self._adapter.execute_stream(self._active_config, request):
            yield chunk


_global_llm_gateway: Optional[LLMGateway] = None


def get_llm_gateway(settings: Optional[Settings] = None) -> LLMGateway:
    """Returns singleton instance of LLMGateway and registers it in component container."""
    global _global_llm_gateway
    if _global_llm_gateway is None:
        _global_llm_gateway = LLMGateway(settings=settings)
        register_component("llm_port", _global_llm_gateway)
        logger.info("Registered LLMGateway singleton under 'llm_port' in component registry")
    return _global_llm_gateway


def init_llm_gateway(settings: Optional[Settings] = None) -> LLMGateway:
    """Explicit initializer for LLMGateway during app startup."""
    return get_llm_gateway(settings)
