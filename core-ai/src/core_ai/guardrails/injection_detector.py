"""Prompt injection and jailbreak detection for ST-Care Core AI.

Implements multi-layered heuristic and pattern-matching defenses covering:
- Instruction overrides / ignore previous commands (bilingual EN/VI)
- System prompt extraction and leakage attempts
- Persona hijacking, DAN mode, and unrestricted jailbreak roleplay
- Special delimiter injection (<|im_start|>, [INST], [SYSTEM], ### Instruction)
- Obfuscated execution commands (Base64 decode + execute, eval, exec)
"""

import logging
import re
import unicodedata
from dataclasses import dataclass, field
from typing import List, Optional

logger = logging.getLogger("core_ai.guardrails.injection_detector")


@dataclass
class InjectionDetectionResult:
    """Outcome of adversarial prompt injection inspection."""

    is_safe: bool
    risk_score: float  # 0.0 (clean) to 1.0 (malicious)
    threat_category: Optional[str] = None
    matched_patterns: List[str] = field(default_factory=list)
    explanation: Optional[str] = None


class InjectionDetector:
    """Evaluates input strings for adversarial prompt injection and jailbreak vectors."""

    # Category 1: Direct Instruction Overrides (EN & VI)
    _INSTRUCTION_OVERRIDE_PATTERNS = [
        re.compile(
            r"(?i)\b(?:ignore|disregard|forget|override|bypass)\s+(?:all\s+)?(?:previous|prior|above|system)\s+(?:instructions|prompts?|rules?|directives?)\b"
        ),
        re.compile(
            r"(?i)\b(?:bỏ qua|quên|hủy bỏ|không tuân theo)\s+(?:tất cả\s+|toàn bộ\s+)?(?:các\s+)?(?:chỉ dẫn|hướng dẫn|mệnh lệnh|quy tắc|câu lệnh)\s+(?:trước|trước đó|hệ thống|ban đầu)\b"
        ),
        re.compile(
            r"(?i)\b(?:start\s+over|new\s+instructions|reset\s+instructions)\s*[:;]"
        ),
        re.compile(
            r"(?i)\b(?:từ\s+bây\s+giờ\s+hãy\s+quên\s+hết|quên\s+hết\s+những\s+gì\s+đã\s+dạy)\b"
        ),
    ]

    # Category 2: System Prompt Exfiltration (EN & VI)
    _EXFILTRATION_PATTERNS = [
        re.compile(
            r"(?i)\b(?:what\s+is|show\s+me|print|reveal|output|display|repeat)\s+(?:your\s+)?(?:exact\s+)?(?:system\s+prompt|initial\s+prompt|instructions|secret\s+instructions|system\s+message)\b"
        ),
        re.compile(
            r"(?i)\b(?:repeat\s+the\s+words\s+above|print\s+everything\s+above|what\s+are\s+the\s+first\s+instructions)\b"
        ),
        re.compile(
            r"(?i)\b(?:tiết lộ|cho\s+tôi\s+xem|hiển thị|in\s+ra|đọc\s+lại)\s+(?:toàn bộ\s+)?(?:prompt\s+hệ\s+thống|system\s+prompt|chỉ dẫn\s+hệ\s+thống|hướng dẫn\s+ẩn|chỉ thị\s+gốc)\b"
        ),
        re.compile(
            r"(?i)\b(?:bạn\s+được\s+lập\s+trình\s+bằng\s+prompt\s+gì|nói\s+cho\s+tôi\s+biết\s+system\s+message)\b"
        ),
    ]

    # Category 3: Persona Hijacking & Jailbreaks (DAN, Developer Mode, Evil, Unfiltered)
    _JAILBREAK_PATTERNS = [
        re.compile(
            r"(?i)\b(?:DAN\s+mode|Do\s+Anything\s+Now|Developer\s+Mode\s+v[0-9]|jailbreak(?:ed)?)\b"
        ),
        re.compile(
            r"(?i)\b(?:you\s+are\s+now|act\s+as|pretend\s+to\s+be)\s+(?:an?\s+)?(?:unfiltered|unrestricted|unethical|evil|jailbroken|godmode)\b"
        ),
        re.compile(
            r"(?i)\b(?:đóng\s+vai|hãy\s+làm|bây\s+giờ\s+bạn\s+là)\s+(?:một\s+)?(?:AI\s+không\s+bị\s+ràng\s+buộc|trợ\s+lý\s+không\s+giới\s+hạn|hacker|nhân\s+vật\s+phản\s+diện)\b"
        ),
        re.compile(
            r"(?i)\b(?:bỏ\s+qua\s+kiểm\s+duyệt|tắt\s+bộ\s+lọc\s+an\s+toàn|vượt\s+tường\s+lửa)\b"
        ),
    ]

    # Category 4: Special Delimiter & Role-Turn Spoofing
    _DELIMITER_SPOOFING_PATTERNS = [
        re.compile(r"<\|im_start\|>|<\|im_end\|>|<\|endoftext\|>|<\|startoftext\|>"),
        re.compile(r"\[SYSTEM\]|\[\/SYSTEM\]|\[INST\]|\[\/INST\]|\[HUMAN\]|\[ASSISTANT\]"),
        re.compile(r"(?i)^###\s+(?:System|Instruction|Assistant|Human|Response)\s*:", re.MULTILINE),
        re.compile(r"(?i)^(?:System|Assistant|AI)\s*:\s*[\"']", re.MULTILINE),
    ]

    # Category 5: Obfuscated Execution & Code Injection Triggers
    _OBFUSCATION_PATTERNS = [
        re.compile(
            r"(?i)\b(?:decode\s+this\s+base64|giải\s+mã\s+base64\s+sau)\s+(?:and\s+(?:run|execute|follow)|và\s+(?:thực\s+thi|làm\s+theo))\b"
        ),
        re.compile(
            r"(?i)\b(?:exec|eval|os\.system|subprocess\.Popen)\s*\("
        ),
    ]

    def __init__(self, risk_threshold: float = 0.5) -> None:
        self.risk_threshold = risk_threshold

    def detect(self, text: str) -> InjectionDetectionResult:
        """Analyzes input text and determines injection probability and threat category."""
        if not text:
            return InjectionDetectionResult(is_safe=True, risk_score=0.0)

        normalized = unicodedata.normalize("NFC", text).strip()
        matched_patterns: List[str] = []
        highest_score = 0.0
        primary_category: Optional[str] = None

        # Check Category 4: Delimiter Spoofing (Severe: score 0.95)
        for pat in self._DELIMITER_SPOOFING_PATTERNS:
            found = pat.findall(normalized)
            if found:
                matched_patterns.append(f"delimiter_spoofing:{found[0]}")
                if highest_score < 0.95:
                    highest_score = 0.95
                    primary_category = "delimiter_spoofing"

        # Check Category 1: Instruction Override (High: score 0.90)
        for pat in self._INSTRUCTION_OVERRIDE_PATTERNS:
            match = pat.search(normalized)
            if match:
                matched_patterns.append(f"instruction_override:{match.group(0)}")
                if highest_score < 0.90:
                    highest_score = 0.90
                    primary_category = "instruction_override"

        # Check Category 2: System Prompt Exfiltration (High: score 0.85)
        for pat in self._EXFILTRATION_PATTERNS:
            match = pat.search(normalized)
            if match:
                matched_patterns.append(f"system_prompt_exfiltration:{match.group(0)}")
                if highest_score < 0.85:
                    highest_score = 0.85
                    primary_category = "system_prompt_exfiltration"

        # Check Category 3: Jailbreak & Persona Hijacking (High: score 0.85)
        for pat in self._JAILBREAK_PATTERNS:
            match = pat.search(normalized)
            if match:
                matched_patterns.append(f"jailbreak_attempt:{match.group(0)}")
                if highest_score < 0.85:
                    highest_score = 0.85
                    primary_category = "jailbreak_attempt"

        # Check Category 5: Obfuscated Payload (Medium-High: score 0.80)
        for pat in self._OBFUSCATION_PATTERNS:
            match = pat.search(normalized)
            if match:
                matched_patterns.append(f"obfuscated_payload:{match.group(0)}")
                if highest_score < 0.80:
                    highest_score = 0.80
                    primary_category = "obfuscated_payload"

        is_safe = highest_score < self.risk_threshold
        explanation = None
        if not is_safe:
            explanation = (
                f"Phát hiện nguy cơ prompt injection thuộc nhóm '{primary_category}' "
                f"(điểm rủi ro: {highest_score:.2f})."
            )
            logger.warning(
                "Prompt injection attempt detected! Category: %s | Risk: %.2f | Triggers: %s",
                primary_category,
                highest_score,
                matched_patterns,
            )

        return InjectionDetectionResult(
            is_safe=is_safe,
            risk_score=highest_score,
            threat_category=primary_category,
            matched_patterns=matched_patterns,
            explanation=explanation,
        )
