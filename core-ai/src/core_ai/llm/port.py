"""LLMPort protocol definition and contract re-exports.

Decouples LangGraph state nodes, orchestrator pipelines, and domain logic
from specific LLM vendor SDKs and adapters.
"""

from typing import Protocol, runtime_checkable

from core_ai.contracts.llm import (
    ChatMessage,
    GenerationRequest,
    GenerationResult,
    LLMPort as ContractLLMPort,
    ModelConfig,
    ProviderCapability,
    TokenUsage,
)


@runtime_checkable
class LLMPort(ContractLLMPort, Protocol):
    """Abstract Port decoupling LangGraph and domain logic from model providers.

    Conforms to core_ai.contracts.llm.LLMPort.
    """

    async def generate(self, request: GenerationRequest) -> GenerationResult:
        """Executes generation against active provider with timeout, local repair, and budget tracking.

        Raises:
            CallBudgetExceededError: If request exceeds 2 external calls.
            ProviderTimeoutError: If call exceeds timeout_seconds.
            ProviderUnavailableError: If provider returns 5xx and failover fails.
            MalformedOutputError: If structured output cannot be parsed or repaired locally.
        """
        ...

    async def get_active_model_config(self) -> ModelConfig:
        """Returns active model configuration and capability profile."""
        ...


__all__ = [
    "LLMPort",
    "ChatMessage",
    "GenerationRequest",
    "GenerationResult",
    "ModelConfig",
    "ProviderCapability",
    "TokenUsage",
]
