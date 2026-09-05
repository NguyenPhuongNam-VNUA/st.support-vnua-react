"""LLM Tests for LLMGateway and Multi-Provider Abstraction.

Tests:
1. Vendor switching via configuration: Gemini, OpenAI, and OpenAI-compatible (vLLM/Ollama).
2. Capability profiles matching each provider.
3. Prompt assembly: GenerationRequest automatically formats messages from prompt/system_prompt.
4. LiteLLMAdapter generation returning typed GenerationResult.
"""

from unittest.mock import AsyncMock

import pytest

from core_ai.config import Settings
from core_ai.contracts.llm import (
    ChatMessage,
    GenerationRequest,
    GenerationResult,
    ModelConfig,
    ProviderCapability,
)
from core_ai.llm.gateway import LLMGateway
from core_ai.llm.litellm_adapter import get_provider_capabilities


class TestLLMGateway:
    def test_provider_capability_mapping(self) -> None:
        """Verifies capability profiles across different provider types."""
        gemini_caps = get_provider_capabilities("gemini", "gemini-3.5-flash")
        assert gemini_caps.supports_json_schema is True
        assert gemini_caps.max_context_tokens >= 32000

        openai_caps = get_provider_capabilities("openai", "gpt-4o-mini")
        assert openai_caps.supports_json_schema is True

        llama_caps = get_provider_capabilities("openai_compatible", "meta-llama/Llama-3-8b")
        assert llama_caps.supports_tool_calling is True

    def test_generation_request_prompt_assembly(self) -> None:
        """GenerationRequest constructs messages list from prompt + system_prompt automatically."""
        req = GenerationRequest(
            request_id="trace-1",
            system_prompt="Bạn là trợ lý ST-Care.",
            prompt="Sinh viên năm 1 học bao nhiêu tín chỉ?",
        )

        assert len(req.messages) == 2
        assert req.messages[0].role == "system"
        assert req.messages[0].content == "Bạn là trợ lý ST-Care."
        assert req.messages[1].role == "user"
        assert req.messages[1].content == "Sinh viên năm 1 học bao nhiêu tín chỉ?"

    @pytest.mark.asyncio
    async def test_llm_gateway_generation_flow(
        self, mock_settings: Settings, mock_litellm_completion: AsyncMock
    ) -> None:
        """Gateway calls LiteLLM adapter and returns typed GenerationResult."""
        gateway = LLMGateway(settings=mock_settings)
        request = GenerationRequest(
            request_id="test-req-1",
            messages=[ChatMessage(role="user", content="Quy chế đào tạo VNUA?")],
        )

        result: GenerationResult = await gateway.generate(request)

        assert isinstance(result, GenerationResult)
        assert result.content != ""
        assert result.provider == "gemini"
        assert result.model == "gemini-3.5-flash"
        assert result.usage.total_tokens > 0

    def test_update_gateway_config_provider_switch(self, mock_settings: Settings) -> None:
        """Verifies seamless runtime provider update from Gemini to OpenAI without modifying logic."""
        gateway = LLMGateway(settings=mock_settings)

        new_config = ModelConfig(
            provider="openai",
            model="gpt-4o",
            api_key="sk-test-key",
            capabilities=ProviderCapability(
                supports_json_schema=True,
                supports_tool_calling=True,
                max_context_tokens=128000,
            ),
        )

        gateway.update_config(new_config)
        active = gateway._active_config

        assert active.provider == "openai"
        assert active.model == "gpt-4o"
        assert active.capabilities.max_context_tokens == 128000
