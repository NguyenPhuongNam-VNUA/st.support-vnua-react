"""Input Guardrail for ST-Care Core AI microservice.

Verifies inbound student queries before pipeline ingestion:
1. Unicode Normalization: Converts text to Unicode NFC and strips invisible control characters.
2. Payload Size Validation: Enforces boundary of 1 to 4000 characters.
3. Prompt Injection Defense: Detects adversarial attempts, jailbreaks, and system prompt exfiltration.
4. Raw PII & Credential Defense: Detects raw passwords, API keys, CCCD, and phone numbers.
"""

from dataclasses import dataclass, field
import logging
import re
import time
from typing import List, Optional
import unicodedata

from core_ai.contracts.chat import ChatRequest, ExecutionTraceStep
from core_ai.contracts.errors import (
    GuardrailBlockedError,
    InvalidPayloadError,
    PayloadTooLargeError,
)
from core_ai.guardrails.injection_detector import (
    InjectionDetectionResult,
    InjectionDetector,
)
from core_ai.guardrails.pii_filter import PIIEntity, PIIFilter

logger = logging.getLogger("core_ai.guardrails.input_guardrail")


@dataclass
class InputGuardrailResult:
    """Consolidated outcome of all input guardrail checks."""

    is_safe: bool
    normalized_text: str
    sanitized_text: str
    detected_pii: List[PIIEntity] = field(default_factory=list)
    injection_result: Optional[InjectionDetectionResult] = None
    violations: List[str] = field(default_factory=list)
    latency_ms: int = 0

    def to_execution_trace_step(self) -> ExecutionTraceStep:
        """Converts result into safe execution trace step without leaking sensitive details."""
        return ExecutionTraceStep(
            step="input_guardrail",
            status="passed" if self.is_safe else "failed",
            latency_ms=self.latency_ms,
            details={
                "char_length": len(self.normalized_text),
                "pii_detected_count": len(self.detected_pii),
                "violations_count": len(self.violations),
            },
        )


class InputGuardrail:
    """Protects the ST-Care system by validating and sanitizing inbound user queries."""

    # Strip zero-width, invisible formatting, and non-printable control characters
    # Preserve newlines (\n, \r) and tabs (\t)
    _CONTROL_CHARS_PATTERN = re.compile(
        r"[\u200B-\u200D\uFEFF\u200E\u200F\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]"
    )

    def __init__(
        self,
        min_length: int = 1,
        max_length: int = 4000,
        block_on_credentials: bool = True,
        block_on_injection: bool = True,
    ) -> None:
        self.min_length = min_length
        self.max_length = max_length
        self.block_on_credentials = block_on_credentials
        self.block_on_injection = block_on_injection
        self.pii_filter = PIIFilter()
        self.injection_detector = InjectionDetector()

    def normalize_unicode(self, text: str) -> str:
        """Applies Unicode NFC normalization and strips zero-width/control characters."""
        if not text:
            return ""
        # 1. Canonical decomposition followed by canonical composition (NFC)
        nfc_text = unicodedata.normalize("NFC", text)
        # 2. Strip invisible and control characters
        cleaned = self._CONTROL_CHARS_PATTERN.sub("", nfc_text)
        # 3. Collapse excessive empty lines while preserving structural spacing
        cleaned = re.sub(r"\r\n|\r", "\n", cleaned)
        return cleaned.strip()

    def validate(
        self,
        text: str,
        mask_pii_in_sanitized: bool = True,
        raise_exception: bool = False,
    ) -> InputGuardrailResult:
        """Executes all input guardrail checks on raw text.

        Args:
            text: Raw input string from student.
            mask_pii_in_sanitized: If True, sanitized_text masks phone numbers and CCCD.
            raise_exception: If True, immediately raises domain exception on failure.

        Returns:
            InputGuardrailResult containing validation flags, normalized text, and metadata.
        """
        t0 = time.perf_counter()
        violations: List[str] = []
        is_safe = True

        # 1. Unicode Normalization
        normalized = self.normalize_unicode(text)

        # 2. Payload Length Validation
        if len(normalized) < self.min_length:
            msg = f"Câu hỏi không được để trống (tối thiểu {self.min_length} ký tự)"
            violations.append(msg)
            is_safe = False
            if raise_exception:
                raise InvalidPayloadError(message=msg)

        if len(normalized) > self.max_length:
            msg = f"Câu hỏi vượt quá giới hạn {self.max_length} ký tự (nhận được {len(normalized)})"
            violations.append(msg)
            is_safe = False
            if raise_exception:
                raise PayloadTooLargeError(message=msg)

        # 3. Prompt Injection Check
        injection_res = self.injection_detector.detect(normalized)
        if not injection_res.is_safe:
            msg = injection_res.explanation or "Phát hiện nguy cơ prompt injection"
            violations.append(msg)
            if self.block_on_injection:
                is_safe = False
                if raise_exception:
                    raise GuardrailBlockedError(message=msg)

        # 4. PII and Credential Detection
        pii_entities = self.pii_filter.detect_pii(normalized)
        has_creds = any(e.entity_type == "secret" for e in pii_entities)
        if has_creds and self.block_on_credentials:
            msg = "Yêu cầu bị chặn do chứa thông tin nhạy cảm (mật khẩu hoặc khóa bảo mật)"
            violations.append(msg)
            is_safe = False
            if raise_exception:
                raise GuardrailBlockedError(message=msg)

        # 5. Build sanitized text
        if mask_pii_in_sanitized and pii_entities:
            sanitized = self.pii_filter.mask_pii(normalized, full_redaction=False)
        else:
            sanitized = normalized

        latency_ms = int((time.perf_counter() - t0) * 1000)

        return InputGuardrailResult(
            is_safe=is_safe,
            normalized_text=normalized,
            sanitized_text=sanitized,
            detected_pii=pii_entities,
            injection_result=injection_res,
            violations=violations,
            latency_ms=latency_ms,
        )

    def check_and_normalize(self, text: str) -> str:
        """Enforces all checks and raises domain exceptions immediately on violation.

        Returns:
            Normalized and validated string.
        """
        res = self.validate(text, raise_exception=True)
        return res.normalized_text

    def validate_request(self, request: ChatRequest) -> InputGuardrailResult:
        """Validates a complete ChatRequest object."""
        return self.validate(request.message, raise_exception=False)
