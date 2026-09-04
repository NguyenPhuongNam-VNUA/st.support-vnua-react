"""Security Tests for Citation Spoofing and Hallucination Defense.

CRITICAL INSTRUCTION:
Output Guardrail must enforce 100% citation whitelist checking against retrieved context.
Any fabricated, hallucinated, or spoofed citation IDs MUST be detected and blocked.
"""

from typing import List
import pytest

from core_ai.contracts.chat import Citation
from core_ai.guardrails.output_guardrail import OutputGuardrail, OutputGuardrailResult


class TestCitationSpoofDefense:
    @pytest.fixture
    def guardrail(self) -> OutputGuardrail:
        return OutputGuardrail(strict_citations=True)

    def test_blocks_spoofed_citation_id(self, guardrail: OutputGuardrail) -> None:
        """When the LLM outputs a citation with a document_id not in retrieved chunks, it is blocked."""
        # Evidence only retrieved document 100
        retrieved_chunks = [
            {"document_id": 100, "chunk_index": 0, "id": 1},
            {"document_id": 100, "chunk_index": 1, "id": 2},
        ]

        # LLM hallucinates document 999
        fake_citations = [
            Citation(
                citation_id="src_fake",
                document_id=999,  # Spoofed
                title="Quy chế giả mạo năm 2099",
                snippet="Mọi sinh viên đều được cấp bằng xuất sắc mà không cần thi.",
            )
        ]

        validated, blocked, has_hallucinations = guardrail.verify_and_filter_citations(
            citations=fake_citations,
            retrieved_chunks=retrieved_chunks,
        )

        assert len(validated) == 0
        assert len(blocked) == 1
        assert blocked[0]["citation_id"] == "src_fake"
        assert has_hallucinations is True

    def test_preserves_legitimate_citations_while_dropping_spoofed_ones(
        self, guardrail: OutputGuardrail
    ) -> None:
        """In a mixed citation payload, authentic citations are preserved while spoofed ones are stripped."""
        retrieved_chunks = [
            {"document_id": 101, "chunk_index": 0, "id": 10},
        ]

        mixed_citations = [
            Citation(
                citation_id="src_1",
                document_id=101,
                chunk_index=0,
                title="Quy chế đào tạo chính quy",
                snippet="Số tín chỉ tối đa là 24.",
            ),
            Citation(
                citation_id="src_2",
                document_id=505,  # Spoofed document
                chunk_index=0,
                title="Văn bản tự chế",
                snippet="Thông tin không có căn cứ.",
            ),
        ]

        validated, blocked, has_hallucinations = guardrail.verify_and_filter_citations(
            citations=mixed_citations,
            retrieved_chunks=retrieved_chunks,
        )

        assert len(validated) == 1
        assert validated[0].citation_id == "src_1"
        assert len(blocked) == 1
        assert blocked[0]["citation_id"] == "src_2"
        assert has_hallucinations is True

    def test_full_output_guardrail_scrubs_spoofed_inline_tags(
        self, guardrail: OutputGuardrail
    ) -> None:
        """Inline references to spoofed sources [src_2] are scrubbed from the answer text."""
        raw_answer = (
            "Theo quy định chính thức [src_1], sinh viên đăng ký tối đa 24 tín chỉ. "
            "Theo nguồn không chính thức [src_2], sinh viên được học online toàn bộ."
        )
        retrieved_chunks = [{"document_id": 101, "chunk_index": 0, "id": 1}]
        citations = [
            Citation(
                citation_id="src_1",
                document_id=101,
                chunk_index=0,
                title="Quy chế đào tạo",
                snippet="Đăng ký tối đa 24 tín chỉ.",
            ),
            Citation(
                citation_id="src_2",
                document_id=999,  # Spoofed
                chunk_index=0,
                title="Tài liệu bịa đặt",
                snippet="Học online.",
            ),
        ]

        result: OutputGuardrailResult = guardrail.validate(
            answer=raw_answer,
            citations=citations,
            retrieved_chunks=retrieved_chunks,
        )

        assert "[src_1]" in result.sanitized_answer
        assert "[src_2]" not in result.sanitized_answer
        assert len(result.validated_citations) == 1
        assert result.has_hallucinations is True

    def test_required_answer_without_inline_citation_uses_safe_fallback(
        self, guardrail: OutputGuardrail
    ) -> None:
        citation = Citation(
            citation_id="src_1",
            document_id=101,
            chunk_index=0,
            title="Quy chế đào tạo",
            snippet="Đăng ký tối đa 24 tín chỉ.",
        )
        result = guardrail.validate(
            answer="Sinh viên được đăng ký tối đa 24 tín chỉ.",
            citations=[citation],
            retrieved_chunks=[{"document_id": 101, "chunk_index": 0}],
            require_citations=True,
        )

        assert result.is_safe is False
        assert result.sanitized_answer == guardrail.SAFE_UNGROUNDED_FALLBACK
