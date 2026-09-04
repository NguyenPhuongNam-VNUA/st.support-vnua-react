"""Unit Tests for Local Structured Output Parser and JSON Repair Engine.

CRITICAL INSTRUCTION:
Validates that malformed LLM outputs are 100% repaired and validated locally
WITHOUT making additional LLM calls.
"""

from pydantic import BaseModel, Field
import pytest

from core_ai.contracts.errors import MalformedOutputError
from core_ai.llm.structured_output import (
    balance_json_brackets,
    extract_candidate_json,
    parse_and_repair_json,
    repair_json_string,
    validate_structured_output,
)


class SampleAnswerSchema(BaseModel):
    answer: str
    confidence: float = Field(ge=0.0, le=1.0)
    topic: str


class TestStructuredOutputParser:
    def test_extract_candidate_json_from_markdown_fences(self) -> None:
        """Extracts JSON enclosed inside ```json ... ``` blocks with surrounding text."""
        raw_output = """
        Dưới đây là kết quả phân tích theo yêu cầu:
        ```json
        {
            "answer": "Học phí tín chỉ là 350.000 VNĐ.",
            "confidence": 0.95,
            "topic": "tuition"
        }
        ```
        Hy vọng thông tin này giúp ích cho bạn!
        """
        extracted = extract_candidate_json(raw_output)
        assert extracted.startswith("{")
        assert extracted.endswith("}")
        assert '"answer"' in extracted

    def test_repair_python_literals_and_trailing_commas(self) -> None:
        """Repairs Python True/False/None and trailing commas locally."""
        malformed = """
        {
            'is_valid': True,
            'is_active': False,
            'extra_info': None,
            'numbers': [1, 2, 3,],
        }
        """
        parsed = parse_and_repair_json(malformed)
        assert parsed["is_valid"] is True
        assert parsed["is_active"] is False
        assert parsed["extra_info"] is None
        assert parsed["numbers"] == [1, 2, 3]

    def test_repair_single_quoted_keys_and_values(self) -> None:
        """Replaces single quotes with double quotes without corrupting text."""
        malformed = "{'answer': 'Quy chế năm 2024', 'page': 14}"
        parsed = parse_and_repair_json(malformed)
        assert parsed["answer"] == "Quy chế năm 2024"
        assert parsed["page"] == 14

    def test_repair_unclosed_truncated_json(self) -> None:
        """Balances brackets and braces for cut-off LLM generation."""
        truncated = '{"answer": "Sinh viên cần tích lũy tối thiểu 125 tín chỉ", "details": {"dept": "Đào tạo"'
        # Missing closing '}' for inner dict and '}' for outer dict
        repaired = repair_json_string(truncated)
        assert repaired.endswith("}}")
        parsed = parse_and_repair_json(truncated)
        assert parsed["answer"].startswith("Sinh viên")
        assert parsed["details"]["dept"] == "Đào tạo"

    def test_balance_json_brackets_open_string(self) -> None:
        """Closes string terminated prematurely, followed by unclosed brackets."""
        cut_off = '{"message": "Đang xử lý câu hỏi'
        balanced = balance_json_brackets(cut_off)
        assert balanced == '{"message": "Đang xử lý câu hỏi"}'

    def test_validate_structured_output_with_pydantic_model(self) -> None:
        """Successfully validates dictionary against Pydantic schema."""
        data = {
            "answer": "Thời hạn đăng ký học phần là tuần 2.",
            "confidence": 0.88,
            "topic": "schedule",
        }
        validated = validate_structured_output(data, SampleAnswerSchema)
        assert validated["answer"] == data["answer"]
        assert validated["confidence"] == 0.88
        assert validated["topic"] == "schedule"

    def test_validate_structured_output_fails_invalid_types(self) -> None:
        """Raises MalformedOutputError on schema violation without external LLM call."""
        invalid_data = {
            "answer": "Test",
            "confidence": 1.5,  # Violates le=1.0
            "topic": "test",
        }
        with pytest.raises(MalformedOutputError) as exc_info:
            validate_structured_output(invalid_data, SampleAnswerSchema)
        assert "không khớp schema Pydantic" in str(exc_info.value)

    def test_unparseable_garbage_raises_malformed_output_error(self) -> None:
        """Completely non-JSON text raises MalformedOutputError after all local repair attempts fail."""
        garbage = "Đây là văn bản thuần túy không chứa bất kỳ cú pháp cấu trúc nào."
        with pytest.raises(MalformedOutputError) as exc_info:
            parse_and_repair_json(garbage)
        assert exc_info.value.code.value == "MALFORMED_OUTPUT"
