"""ST-Care LLM Gateway Module.

Provides vendor-neutral LLM abstraction conforming to core_ai.contracts.llm.LLMPort,
multi-provider LiteLLM adapter (Gemini default gemini-3.5-flash, OpenAI, OpenAI-compatible),
strict 2-call budget enforcement, local structured output validation and repair,
and VNUA student assistant prompt persona.
"""

import logging

from core_ai.llm.gateway import (
    LLMGateway,
    get_llm_gateway,
    init_llm_gateway,
)
from core_ai.llm.litellm_adapter import (
    LiteLLMAdapter,
    format_model_for_litellm,
    get_provider_capabilities,
)
from core_ai.llm.port import LLMPort
from core_ai.llm.prompts.st_care import (
    ST_CARE_SYSTEM_PROMPT,
    build_grounded_rag_prompt,
    build_st_care_system_prompt,
    format_evidence_context,
    get_budget_exceeded_response,
    get_no_evidence_response,
    get_safe_fallback_response,
)
from core_ai.llm.structured_output import (
    balance_json_brackets,
    extract_candidate_json,
    parse_and_repair_json,
    repair_json_string,
    validate_structured_output,
)

logger = logging.getLogger("core_ai.llm")

# Eagerly register default LLMGateway singleton under 'llm_port'
try:
    init_llm_gateway()
except Exception as err:
    logger.debug("Deferred auto-registration of LLMGateway: %s", err)

__all__ = [
    # Gateway & Port
    "LLMPort",
    "LLMGateway",
    "get_llm_gateway",
    "init_llm_gateway",
    # Adapter
    "LiteLLMAdapter",
    "get_provider_capabilities",
    "format_model_for_litellm",
    # Structured Output & Repair
    "extract_candidate_json",
    "balance_json_brackets",
    "repair_json_string",
    "parse_and_repair_json",
    "validate_structured_output",
    # Prompts & Persona
    "ST_CARE_SYSTEM_PROMPT",
    "build_st_care_system_prompt",
    "format_evidence_context",
    "build_grounded_rag_prompt",
    "get_safe_fallback_response",
    "get_no_evidence_response",
    "get_budget_exceeded_response",
]
