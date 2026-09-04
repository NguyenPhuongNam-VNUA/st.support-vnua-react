"""Security Tests for Personally Identifiable Information (PII) Detection & Sanitization.

Tests:
1. Vietnamese Citizen Identity Cards (CCCD 12 digits, CMND 9 digits).
2. Vietnamese Mobile phone numbers in various formats (09x, 03x, +84).
3. Personal email addresses.
4. Passwords and credentials (Bearer tokens, API keys).
5. Automatic masking of detected PII entities in sanitized output.
"""

import pytest

from core_ai.guardrails.pii_filter import PIIFilter


@pytest.fixture
def pii_filter() -> PIIFilter:
    return PIIFilter()


class TestPIISanitization:
    def test_detect_and_mask_vietnamese_cccd(self, pii_filter: PIIFilter) -> None:
        """Detects 12-digit Vietnamese CCCD and masks middle digits."""
        text = "Số căn cước công dân của tôi là 001202012345 cần xác nhận."
        entities = pii_filter.detect_pii(text)

        assert len(entities) >= 1
        cccd_entity = next(e for e in entities if e.entity_type == "cccd")
        assert cccd_entity.text == "001202012345"

        masked = pii_filter.mask_pii(text)
        assert "001202012345" not in masked
        assert "******" in masked or "[CCCD_" in masked or "001" in masked

    def test_detect_and_mask_vietnamese_phone_numbers(self, pii_filter: PIIFilter) -> None:
        """Detects various Vietnamese phone number formats (+84912345678, 0987654321)."""
        text = "Liên hệ qua số 0987654321 hoặc +84912345678 để được hỗ trợ."
        entities = pii_filter.detect_pii(text)

        phone_entities = [e for e in entities if e.entity_type == "phone"]
        assert len(phone_entities) >= 2

        masked = pii_filter.mask_pii(text)
        assert "0987654321" not in masked
        assert "+84912345678" not in masked

    def test_detect_and_mask_email_addresses(self, pii_filter: PIIFilter) -> None:
        """Detects personal email addresses and masks them."""
        text = "Gửi thông tin về email sinhvien.test@gmail.com để nhận kết quả."
        entities = pii_filter.detect_pii(text)

        email_entities = [e for e in entities if e.entity_type == "email"]
        assert len(email_entities) == 1
        assert email_entities[0].text == "sinhvien.test@gmail.com"

        masked = pii_filter.mask_pii(text)
        assert "sinhvien.test@gmail.com" not in masked

    def test_detect_raw_credentials_and_passwords(self, pii_filter: PIIFilter) -> None:
        """Detects exposed passwords and bearer tokens."""
        text = "Mật khẩu: my_secret_pass_123 và api_key=sk-1234567890abcdef"
        assert pii_filter.contains_credentials(text) is True

        entities = pii_filter.detect_pii(text)
        secret_entities = [e for e in entities if e.entity_type in ("secret", "password")]
        assert len(secret_entities) >= 1

        masked = pii_filter.mask_pii(text)
        assert "my_secret_pass_123" not in masked
        assert "sk-1234567890abcdef" not in masked

    def test_benign_administrative_numbers_not_falsely_flagged(
        self, pii_filter: PIIFilter
    ) -> None:
        """Administrative course codes and regulation numbers are not flagged as phone or CCCD."""
        benign_text = "Mã học phần TH01001 hoặc Quyết định số 1234/QĐ-HVN ngày 15/05/2024."
        entities = pii_filter.detect_pii(benign_text)
        assert len(entities) == 0
