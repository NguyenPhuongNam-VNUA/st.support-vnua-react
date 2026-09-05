from core_ai.contracts.chat import Citation
from core_ai.guardrails.output_guardrail import OutputGuardrail


def _citation(snippet: str) -> Citation:
    return Citation(
        citation_id="src_1",
        document_id=1,
        chunk_index=0,
        title="Thông báo chính thức",
        snippet=snippet,
    )


def test_numeric_claim_must_appear_in_evidence() -> None:
    guard = OutputGuardrail()
    result = guard.validate(
        "Học phí là 450.000 đồng [src_1].",
        [_citation("Mức học phí là 350.000 đồng.")],
        [{"document_id": 1, "chunk_index": 0}],
        require_citations=True,
    )
    assert result.is_safe is False
    assert "450.000" not in result.sanitized_answer


def test_markdown_list_number_is_not_treated_as_factual_mismatch() -> None:
    guard = OutputGuardrail()
    result = guard.validate(
        "1. Nộp đơn tại phòng đào tạo [src_1].",
        [_citation("Nộp đơn tại phòng đào tạo.")],
        [{"document_id": 1, "chunk_index": 0}],
        require_citations=True,
    )
    assert result.is_safe is True
