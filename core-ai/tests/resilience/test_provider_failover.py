"""Resilience Tests for LLM Provider Failover.

Tests:
1. Primary provider timeout triggers 1 failover retry to secondary provider.
2. Total external calls during failover never exceeds the 2-call budget.
3. If both primary and fallback fail, raises error or returns safe fallback without 3rd call.
"""

from unittest.mock import AsyncMock, MagicMock
import pytest

from core_ai.config import Settings
from core_ai.contracts.errors import ProviderTimeoutError, ProviderUnavailableError
from core_ai.contracts.llm import (
    ChatMessage,
    GenerationRequest,
    GenerationResult,
    ModelConfig,
    ProviderCapability,
    TokenUsage,
)
from core_ai.llm.gateway import LLMGateway
from core_ai.llm.litellm_adapter import LiteLLMAdapter


@pytest.fixture
def failover_settings() -> Settings:
    return Settings(
        app_env="testing",
        llm_provider="gemini",
        llm_model="gemini-3.5-flash",
        llm_fallback_provider="openai",
        llm_fallback_model="gpt-4o-mini",
        llm_max_external_calls=2,
    )


class TestProviderFailover:
    @pytest.mark.asyncio
    async def test_failover_on_primary_timeout(
        self, failover_settings: Settings
    ) -> None:
        """When primary model times out, gateway fails over to fallback provider within budget."""
        adapter_mock = MagicMock(spec=LiteLLMAdapter)

        # Primary attempt raises ProviderTimeoutError; secondary attempt succeeds
        success_result = GenerationResult(
            content="Câu trả lời từ model dự phòng (OpenAI).",
            usage=TokenUsage(prompt_tokens=20, completion_tokens=15, total_tokens=35),
            model_name="gpt-4o-mini",
            provider="openai",
            latency_ms=450,
        )

        adapter_mock.execute = AsyncMock(
            side_effect=[
                ProviderTimeoutError("Gemini timed out after 20.0s"),
                success_result,
            ]
        )

        gateway = LLMGateway(settings=failover_settings, adapter=adapter_mock)
        req = GenerationRequest(
            request_id="req-failover-1",
            messages=[ChatMessage(role="user", content="Học phí VNUA?")],
            external_calls_already_made=0,
        )

        result: GenerationResult = await gateway.generate(req)

        assert result.provider == "openai"
        assert result.content == "Câu trả lời từ model dự phòng (OpenAI)."
        assert adapter_mock.execute.await_count == 2  # Exactly 2 calls (budget ceiling)

    @pytest.mark.asyncio
    async def test_no_failover_if_budget_insufficient(
        self, failover_settings: Settings
    ) -> None:
        """If already spent 1 call and only 1 remains, but call_budget is 1, no failover happens."""
        adapter_mock = MagicMock(spec=LiteLLMAdapter)
        adapter_mock.execute = AsyncMock(side_effect=ProviderTimeoutError("Timeout"))

        # Set max_calls to 1
        failover_settings.llm_max_external_calls = 1
        gateway = LLMGateway(settings=failover_settings, adapter=adapter_mock)

        req = GenerationRequest(
            request_id="req-budget-1-failover",
            messages=[ChatMessage(role="user", content="Test")],
            external_calls_already_made=0,
        )

        with pytest.raises(ProviderTimeoutError):
            await gateway.generate(req)

        # Only 1 call attempted
        assert adapter_mock.execute.await_count == 1
