"""LiteLLM Adapter for ST-Care Core AI.

Provides multi-provider abstraction supporting Google Gemini (default gemini-3.5-flash),
OpenAI, and OpenAI-compatible endpoints (vLLM / Ollama for Llama, Qwen).
Translates exceptions to domain CoreAI errors and performs local JSON repair when needed.
"""

import asyncio
import logging
import time
from typing import Any, AsyncGenerator, Dict, List, Optional

import litellm
from litellm.exceptions import (
    APIConnectionError,
    AuthenticationError,
    InternalServerError,
    RateLimitError,
    ServiceUnavailableError,
    Timeout as LiteLLMTimeout,
)

from core_ai.contracts.errors import (
    ProviderTimeoutError,
    ProviderUnavailableError,
)
from core_ai.contracts.llm import (
    ChatMessage,
    GenerationRequest,
    GenerationResult,
    ModelConfig,
    ProviderCapability,
    TokenUsage,
)
from core_ai.llm.structured_output import parse_and_repair_json, validate_structured_output

# Configure litellm safe behavior
litellm.drop_params = True
litellm.telemetry = False

logger = logging.getLogger("core_ai.llm.litellm_adapter")


def get_provider_capabilities(provider: str, model: str) -> ProviderCapability:
    """Returns declarative capability profile for the specified provider and model."""
    provider_lower = provider.lower()

    if provider_lower == "gemini":
        return ProviderCapability(
            provider_name="gemini",
            supports_native_json=True,
            supports_json_schema=True,
            supports_tool_calling=True,
            supports_system_prompt=True,
            max_context_tokens=1048576,
            max_output_tokens=8192,
            local_repair_required=False,
        )
    elif provider_lower == "openai":
        return ProviderCapability(
            provider_name="openai",
            supports_native_json=True,
            supports_json_schema=True,
            supports_tool_calling=True,
            supports_system_prompt=True,
            max_context_tokens=128000,
            max_output_tokens=4096,
            local_repair_required=False,
        )
    else:  # openai_compatible (vLLM / Ollama / Llama / Qwen)
        return ProviderCapability(
            provider_name="openai_compatible",
            supports_native_json=True,
            supports_json_schema=False,
            supports_tool_calling=False,
            supports_system_prompt=True,
            max_context_tokens=32768,
            max_output_tokens=4096,
            local_repair_required=True,
        )


def format_model_for_litellm(provider: str, model: str) -> str:
    """Formats vendor and model identifier into LiteLLM standard convention."""
    provider_lower = provider.lower()
    model_clean = model.strip()

    if provider_lower == "gemini":
        if model_clean.startswith("gemini/"):
            return model_clean
        return f"gemini/{model_clean}"
    elif provider_lower == "openai":
        if model_clean.startswith("openai/"):
            return model_clean
        return model_clean
    elif provider_lower == "openai_compatible":
        if model_clean.startswith("openai/"):
            return model_clean
        return f"openai/{model_clean}"
    return model_clean


def convert_messages_to_dicts(messages: List[ChatMessage]) -> List[Dict[str, Any]]:
    """Converts strongly-typed ChatMessage list into dictionaries expected by LiteLLM."""
    formatted: List[Dict[str, Any]] = []
    for msg in messages:
        entry: Dict[str, Any] = {
            "role": msg.role,
            "content": msg.content,
        }
        if msg.name and msg.role == "tool":
            entry["name"] = msg.name
        formatted.append(entry)
    return formatted


class LiteLLMAdapter:
    """Production LiteLLM adapter handling async completions, streaming, and error mapping."""

    def __init__(self) -> None:
        self._logger = logging.getLogger("core_ai.llm.litellm_adapter")

    async def execute(
        self,
        config: ModelConfig,
        request: GenerationRequest,
    ) -> GenerationResult:
        """Executes non-streaming completion call against configured model provider."""
        model_str = format_model_for_litellm(config.provider, config.model)
        messages_dict = convert_messages_to_dicts(request.messages)

        call_kwargs: Dict[str, Any] = {
            "model": model_str,
            "messages": messages_dict,
            "temperature": request.temperature,
            "max_tokens": request.max_tokens,
            "top_p": request.top_p,
            "timeout": request.timeout_seconds,
        }

        if config.api_key:
            call_kwargs["api_key"] = config.api_key
        elif config.provider == "openai_compatible":
            call_kwargs["api_key"] = "EMPTY"  # Standard placeholder for local vLLM/Ollama

        if config.base_url:
            call_kwargs["api_base"] = config.base_url

        if request.stop_sequences:
            call_kwargs["stop"] = request.stop_sequences

        # Determine structured response mode
        capabilities = config.capabilities or get_provider_capabilities(config.provider, config.model)
        wants_json = bool(request.response_format or request.json_schema)

        if wants_json and capabilities.supports_native_json and not capabilities.local_repair_required:
            if request.json_schema and capabilities.supports_json_schema:
                call_kwargs["response_format"] = {
                    "type": "json_object",
                    "response_schema": request.json_schema,
                }
            else:
                call_kwargs["response_format"] = {"type": "json_object"}

        start_time = time.perf_counter()

        try:
            self._logger.info(
                "Calling LiteLLM [%s:%s] for request_id=%s (timeout=%.1fs)",
                config.provider,
                model_str,
                request.request_id,
                request.timeout_seconds,
            )
            response = await litellm.acompletion(**call_kwargs)
        except (LiteLLMTimeout, asyncio.TimeoutError) as err:
            self._logger.warning(
                "LiteLLM timeout for request_id=%s after %.1fs: %s",
                request.request_id,
                request.timeout_seconds,
                err,
            )
            raise ProviderTimeoutError(
                f"Nhà cung cấp mô hình {config.provider} ({config.model}) phản hồi quá thời gian quy định ({request.timeout_seconds}s)"
            ) from err
        except (
            APIConnectionError,
            ServiceUnavailableError,
            InternalServerError,
            AuthenticationError,
            RateLimitError,
        ) as err:
            self._logger.error(
                "LiteLLM provider failure [%s] for request_id=%s: %s",
                config.provider,
                request.request_id,
                err,
            )
            raise ProviderUnavailableError(
                f"Dịch vụ mô hình AI ({config.provider}) gặp sự cố: {str(err)}"
            ) from err
        except Exception as err:
            self._logger.error(
                "Unexpected error during LiteLLM call for request_id=%s: %s",
                request.request_id,
                err,
                exc_info=True,
            )
            raise ProviderUnavailableError(
                f"Lỗi không xác định khi kết nối dịch vụ AI ({config.provider}): {str(err)}"
            ) from err

        latency_ms = int((time.perf_counter() - start_time) * 1000)

        # Extract generated content
        choice = response.choices[0]
        raw_content = choice.message.content or ""
        finish_reason = choice.finish_reason or "stop"
        if finish_reason not in ["stop", "length", "tool_calls", "content_filter", "error"]:
            finish_reason = "stop"

        # Extract token usage and cost
        usage_info = getattr(response, "usage", None)
        prompt_tokens = getattr(usage_info, "prompt_tokens", 0) or 0
        completion_tokens = getattr(usage_info, "completion_tokens", 0) or 0
        total_tokens = getattr(usage_info, "total_tokens", 0) or (prompt_tokens + completion_tokens)

        cost_usd: Optional[float] = None
        try:
            cost_usd = float(litellm.completion_cost(completion_response=response))
        except Exception:
            cost_usd = None

        token_usage = TokenUsage(
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_tokens=total_tokens,
            estimated_cost_usd=cost_usd,
        )

        # Parse & repair structured output locally if requested or needed
        parsed_json: Optional[Dict[str, Any]] = None
        if wants_json:
            parsed_json = parse_and_repair_json(raw_content)
            if request.json_schema:
                parsed_json = validate_structured_output(parsed_json, request.json_schema)

        return GenerationResult(
            content=raw_content,
            parsed_json=parsed_json,
            structured_output=parsed_json,
            usage=token_usage,
            tokens=token_usage,
            model_name=config.model,
            model=config.model,
            provider=config.provider,
            latency_ms=latency_ms,
            finish_reason=finish_reason,
        )

    async def execute_stream(
        self,
        config: ModelConfig,
        request: GenerationRequest,
    ) -> AsyncGenerator[str, None]:
        """Executes streaming completion call against configured model provider yielding text chunks."""
        model_str = format_model_for_litellm(config.provider, config.model)
        messages_dict = convert_messages_to_dicts(request.messages)

        call_kwargs: Dict[str, Any] = {
            "model": model_str,
            "messages": messages_dict,
            "temperature": request.temperature,
            "max_tokens": request.max_tokens,
            "top_p": request.top_p,
            "timeout": request.timeout_seconds,
            "stream": True,
        }

        if config.api_key:
            call_kwargs["api_key"] = config.api_key
        elif config.provider == "openai_compatible":
            call_kwargs["api_key"] = "EMPTY"

        if config.base_url:
            call_kwargs["api_base"] = config.base_url

        if request.stop_sequences:
            call_kwargs["stop"] = request.stop_sequences

        try:
            response_stream = await litellm.acompletion(**call_kwargs)
            async for chunk in response_stream:
                choices = getattr(chunk, "choices", [])
                if choices:
                    delta = choices[0].delta
                    content = getattr(delta, "content", None)
                    if content:
                        yield content
        except (LiteLLMTimeout, asyncio.TimeoutError) as err:
            raise ProviderTimeoutError(
                f"Nhà cung cấp mô hình {config.provider} timed out trong quá trình streaming"
            ) from err
        except Exception as err:
            raise ProviderUnavailableError(
                f"Lỗi khi nhận luồng streaming từ {config.provider}: {str(err)}"
            ) from err
