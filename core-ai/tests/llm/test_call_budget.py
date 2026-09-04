"""LLM Tests for Call Budget Enforcement.

CRITICAL INSTRUCTION:
Enforces strict ceiling: maximum 2 external AI calls per request under all circumstances.
Never make a 3rd model call!
"""

from unittest.mock import AsyncMock
import pytest

from core_ai.config import Settings
from core_ai.contracts.errors import CallBudgetExceededError
from core_ai.contracts.llm import ChatMessage, GenerationRequest
from core_ai.llm.gateway import LLMGateway


class TestCallBudget:
    @pytest.mark.asyncio
    async def test_normal_path_consumes_one_call(
        self, mock_settings: Settings, mock_litellm_completion: AsyncMock
    ) -> None:
        """First generation call executes normally within budget."""
        gateway = LLMGateway(settings=mock_settings)
        req = GenerationRequest(
            request_id="req-budget-1",
            messages=[ChatMessage(role="user", content="Test")],
            external_calls_already_made=0,
        )

        res = await gateway.generate(req)
        assert res.content != ""
        assert mock_litellm_completion.await_count == 1

    @pytest.mark.asyncio
    async def test_budget_exceeded_raises_error(
        self, mock_settings: Settings, mock_litellm_completion: AsyncMock
    ) -> None:
        """Attempting a 3rd external call (external_calls_already_made == 2) raises CallBudgetExceededError."""
        gateway = LLMGateway(settings=mock_settings, safe_fallback_on_exhaustion=False)
        req = GenerationRequest(
            request_id="req-budget-exceeded",
            messages=[ChatMessage(role="user", content="Test")],
            external_calls_already_made=2,  # Already made 2 calls (ceiling reached)
        )

        with pytest.raises(CallBudgetExceededError):
            await gateway.generate(req)

        # Model was NOT called a 3rd time
        mock_litellm_completion.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_budget_exceeded_safe_fallback_mode(
        self, mock_settings: Settings, mock_litellm_completion: AsyncMock
    ) -> None:
        """When safe_fallback_on_exhaustion=True, returns deterministic fallback without extra call."""
        gateway = LLMGateway(settings=mock_settings, safe_fallback_on_exhaustion=True)
        req = GenerationRequest(
            request_id="req-budget-fallback",
            messages=[ChatMessage(role="user", content="Test")],
            external_calls_already_made=2,
        )

        res = await gateway.generate(req)
        assert "tạm thời bận" in res.content or "liên hệ" in res.content
        assert res.usage.total_tokens == 0
        mock_litellm_completion.assert_not_awaited()
