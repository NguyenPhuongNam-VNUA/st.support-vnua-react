"""Guardrails package for ST-Care Core AI microservice.

Provides inbound validation and outbound verification:
- InputGuardrail: Normalizes text, validates length, blocks prompt injections and raw PII.
- OutputGuardrail: Enforces 100% citation whitelist, masks output PII, and sanitizes HTML/XSS.
- PIIFilter: Specialised Vietnamese CCCD, phone, email, and credentials scanner/masker.
- InjectionDetector: Heuristic and pattern detector for jailbreaks and prompt injections.
"""

from core_ai.guardrails.injection_detector import (
    InjectionDetectionResult,
    InjectionDetector,
)
from core_ai.guardrails.input_guardrail import (
    InputGuardrail,
    InputGuardrailResult,
)
from core_ai.guardrails.output_guardrail import (
    OutputGuardrail,
    OutputGuardrailResult,
)
from core_ai.guardrails.pii_filter import (
    PIIEntity,
    PIIFilter,
)

__all__ = [
    "InputGuardrail",
    "InputGuardrailResult",
    "OutputGuardrail",
    "OutputGuardrailResult",
    "PIIFilter",
    "PIIEntity",
    "InjectionDetector",
    "InjectionDetectionResult",
]
