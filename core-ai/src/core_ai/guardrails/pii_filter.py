"""PII (Personally Identifiable Information) detection and masking for ST-Care.

Specifically designed for Vietnamese administrative and academic contexts:
- Vietnamese Citizen Identity Cards (CCCD 12 digits, CMND 9 digits)
- Vietnamese Mobile and Landline phone numbers (+84, 03x, 05x, 07x, 08x, 09x)
- Personal and institutional email addresses
- Raw passwords, API keys, tokens, and secret credentials
"""

from dataclasses import dataclass
import re
from typing import List, Optional


@dataclass
class PIIEntity:
    """Represents an identified PII entity within a text span."""

    entity_type: str  # 'cccd', 'phone', 'email', 'secret', 'cmnd'
    text: str
    start: int
    end: int
    masked_value: str
    confidence: float = 1.0


class PIIFilter:
    """Detects and masks sensitive personal identifiers and credentials."""

    # Vietnamese Citizen ID (CCCD - 12 digits):
    # CCCD structure: 3 digits province code (001-096), 1 digit gender/century (0-9),
    # 2 digits birth year, 6 sequential digits.
    # We match 12-digit numbers optionally formatted with dots or spaces.
    _CCCD_PATTERN = re.compile(
        r"(?<!\d)(0\d{2}[.\s]?\d{1}[.\s]?\d{2}[.\s]?\d{6})(?!\d)"
    )

    # Legacy 9-digit CMND (requires keyword context or strict boundary)
    _CMND_KEYWORD_PATTERN = re.compile(
        r"(?i)(?:cmnd|chứng minh nhân dân|chứng minh thư|số cmnd)\s*[:=]?\s*(\b\d{9}\b)"
    )

    # Vietnamese Phone numbers:
    # Formats: 03x, 05x, 07x, 08x, 09x followed by 7 digits; or international prefix +84 / 84
    # Optional separators: spaces, dots, dashes.
    _PHONE_PATTERN = re.compile(
        r"(?<!\d)(?:(?:\+84|84|0)(?:3[2-9]|5[25689]|7[06-9]|8[1-9]|9\d))"
        r"(?:[.\s-]?[0-9]{3}[.\s-]?[0-9]{4}|[.\s-]?[0-9]{7})(?!\d)"
    )

    # Email address (RFC 5322 simplified)
    _EMAIL_PATTERN = re.compile(
        r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b"
    )

    # Student ID is only treated as PII with explicit Vietnamese/English context.
    _MSSV_PATTERN = re.compile(
        r"(?i)(?:mssv|mã\s+sinh\s+viên|student\s*id)\s*[:=#-]?\s*([A-Z]{0,3}\d{6,12})\b"
    )

    # Raw Passwords and Credential exposures:
    _PASSWORD_PATTERN = re.compile(
        r"(?i)(?:mật\s*khẩu|mat\s*khau|password|passwd|pwd)\s*[:=]\s*([^\s,;]{3,})"
    )

    # Secrets, API Keys, Tokens, and Private Keys:
    _SECRET_KEY_PATTERN = re.compile(
        r"(?i)(?:api[-_]?key|client[-_]?secret|access[-_]?token|secret[-_]?key)\s*[:=]\s*([^\s,;]{8,})"
    )
    _BEARER_TOKEN_PATTERN = re.compile(
        r"\bBearer\s+([A-Za-z0-9_\-\.]{20,})\b"
    )
    _JWT_PATTERN = re.compile(
        r"\beyJ[A-Za-z0-9_\-]{10,}\.eyJ[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}\b"
    )

    def __init__(self) -> None:
        pass

    def detect_pii(self, text: str) -> List[PIIEntity]:
        """Scans text and returns all detected PII entities with their positions."""
        if not text:
            return []

        entities: List[PIIEntity] = []

        # 1. Detect CCCD (12 digits)
        for match in self._CCCD_PATTERN.finditer(text):
            val = match.group(1)
            clean_digits = re.sub(r"\D", "", val)
            if len(clean_digits) == 12:
                masked = self._mask_cccd(clean_digits)
                entities.append(
                    PIIEntity(
                        entity_type="cccd",
                        text=val,
                        start=match.start(1),
                        end=match.end(1),
                        masked_value=masked,
                        confidence=0.95,
                    )
                )

        # 2. Detect CMND (9 digits with keyword context)
        for match in self._CMND_KEYWORD_PATTERN.finditer(text):
            val = match.group(1)
            entities.append(
                PIIEntity(
                    entity_type="cmnd",
                    text=val,
                    start=match.start(1),
                    end=match.end(1),
                    masked_value=self._mask_cmnd(val),
                    confidence=0.90,
                )
            )

        # 3. Detect Phone numbers
        for match in self._PHONE_PATTERN.finditer(text):
            val = match.group(0)
            clean_digits = re.sub(r"\D", "", val)
            # Ensure it doesn't overlap with an already captured CCCD
            start, end = match.start(), match.end()
            if not any(e.start <= start and end <= e.end for e in entities):
                masked = self._mask_phone(val)
                entities.append(
                    PIIEntity(
                        entity_type="phone",
                        text=val,
                        start=start,
                        end=end,
                        masked_value=masked,
                        confidence=0.90,
                    )
                )

        # 4. Detect Emails
        for match in self._EMAIL_PATTERN.finditer(text):
            val = match.group(0)
            entities.append(
                PIIEntity(
                    entity_type="email",
                    text=val,
                    start=match.start(),
                    end=match.end(),
                    masked_value=self._mask_email(val),
                    confidence=0.98,
                )
            )

        # 4b. Detect contextual student identifiers
        for match in self._MSSV_PATTERN.finditer(text):
            val = match.group(1)
            entities.append(
                PIIEntity(
                    entity_type="mssv",
                    text=val,
                    start=match.start(1),
                    end=match.end(1),
                    masked_value=f"{val[:2]}***{val[-2:]}",
                    confidence=0.96,
                )
            )

        # 5. Detect Passwords
        for match in self._PASSWORD_PATTERN.finditer(text):
            val = match.group(1)
            entities.append(
                PIIEntity(
                    entity_type="secret",
                    text=val,
                    start=match.start(1),
                    end=match.end(1),
                    masked_value="[REDACTED_PASSWORD]",
                    confidence=0.99,
                )
            )

        # 6. Detect API Keys / Secrets
        for match in self._SECRET_KEY_PATTERN.finditer(text):
            val = match.group(1)
            entities.append(
                PIIEntity(
                    entity_type="secret",
                    text=val,
                    start=match.start(1),
                    end=match.end(1),
                    masked_value="[REDACTED_SECRET]",
                    confidence=0.99,
                )
            )

        # 7. Detect Bearer tokens
        for match in self._BEARER_TOKEN_PATTERN.finditer(text):
            val = match.group(1)
            entities.append(
                PIIEntity(
                    entity_type="secret",
                    text=val,
                    start=match.start(1),
                    end=match.end(1),
                    masked_value="[REDACTED_BEARER_TOKEN]",
                    confidence=0.99,
                )
            )

        # 8. Detect JWT tokens
        for match in self._JWT_PATTERN.finditer(text):
            val = match.group(0)
            entities.append(
                PIIEntity(
                    entity_type="secret",
                    text=val,
                    start=match.start(),
                    end=match.end(),
                    masked_value="[REDACTED_JWT]",
                    confidence=0.99,
                )
            )

        # Sort entities by start index descending for safe sequential replacement
        entities.sort(key=lambda x: x.start)
        return entities

    def has_credentials(self, text: str) -> bool:
        """Returns True if the text exposes raw credentials (passwords, tokens, api keys)."""
        entities = self.detect_pii(text)
        return any(e.entity_type == "secret" for e in entities)

    def has_sensitive_raw_pii(self, text: str) -> bool:
        """Returns True if the text contains high-risk PII: CCCD or raw secrets."""
        entities = self.detect_pii(text)
        return any(e.entity_type in ("secret", "cccd") for e in entities)

    def mask_pii(self, text: str, full_redaction: bool = False) -> str:
        """Replaces detected PII spans with masked values.

        If full_redaction is True, replaces with explicit placeholders like [CCCD_ĐÃ_ẨN].
        If False, uses partial masking preserving contextual structure.
        """
        if not text:
            return ""

        entities = self.detect_pii(text)
        if not entities:
            return text

        # Sort by start index in reverse order to replace from end to start without index shift
        sorted_entities = sorted(entities, key=lambda e: e.start, reverse=True)

        chars = list(text)
        for entity in sorted_entities:
            if full_redaction:
                replacement = f"[{entity.entity_type.upper()}_REDACTED]"
            else:
                replacement = entity.masked_value

            chars[entity.start : entity.end] = list(replacement)

        return "".join(chars)

    @staticmethod
    def _mask_cccd(digits: str) -> str:
        """Mask 12-digit CCCD preserving first 4 and last 2 digits: 0012******45."""
        if len(digits) == 12:
            return f"{digits[:4]}******{digits[-2:]}"
        return "[CCCD_ĐÃ_ẨN]"

    @staticmethod
    def _mask_cmnd(digits: str) -> str:
        """Mask 9-digit CMND: 012***789."""
        if len(digits) == 9:
            return f"{digits[:3]}***{digits[-3:]}"
        return "[CMND_ĐÃ_ẨN]"

    @staticmethod
    def _mask_phone(phone_str: str) -> str:
        """Mask phone number: preserve prefix (first 3-4 chars) and last 3 chars."""
        clean = re.sub(r"\D", "", phone_str)
        if len(clean) >= 10:
            prefix = phone_str[:3]
            suffix = phone_str[-3:]
            return f"{prefix}****{suffix}"
        return "[SĐT_ĐÃ_ẨN]"

    @staticmethod
    def _mask_email(email_str: str) -> str:
        """Mask email address: j*****e@domain.com."""
        try:
            local, domain = email_str.split("@", 1)
            if len(local) <= 2:
                masked_local = local[0] + "*"
            else:
                masked_local = f"{local[0]}{'*' * (len(local) - 2)}{local[-1]}"
            return f"{masked_local}@{domain}"
        except Exception:
            return "[EMAIL_ĐÃ_ẨN]"
