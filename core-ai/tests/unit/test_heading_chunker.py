from core_ai.ingestion.chunker import DocumentChunker, build_legal_markdown
from core_ai.ingestion.pdf_parser import ParsedPDF, PDFPage


def test_default_chunk_limits_match_ingestion_policy() -> None:
    chunker = DocumentChunker()
    assert (
        chunker.target_tokens,
        chunker.max_tokens,
        chunker.hard_max_tokens,
        chunker.overlap_tokens,
    ) == (800, 1000, 1000, 100)


def test_heading_and_table_provenance_are_preserved() -> None:
    text = """# Học phí
Mức thu được công bố theo từng học kỳ.

| Khoản | Mức |
|---|---|
| Tín chỉ | Theo thông báo |

# Lịch học
Lịch học được công bố trên cổng đào tạo.
"""
    chunks = DocumentChunker(min_tokens=10, max_tokens=80, target_tokens=30).chunk_text(text)
    tuition_chunk = next(chunk for chunk in chunks if chunk.heading_path == ["Học phí"])
    assert tuition_chunk.kind == "mixed"
    assert "| Khoản | Mức |" in tuition_chunk.content
    assert any(chunk.heading_path == ["Lịch học"] for chunk in chunks)
    assert len({chunk.content_hash for chunk in chunks}) == len(chunks)


def test_small_blocks_under_one_heading_are_not_fragmented() -> None:
    text = """# Học phí
Mức thu được công bố theo từng học kỳ.

| Khoản | Mức |
|---|---|
| Tín chỉ | Theo thông báo |

Sinh viên kiểm tra công nợ trên cổng đào tạo.

# Lịch học
Lịch học được công bố riêng.
"""

    chunks = DocumentChunker(
        min_tokens=10,
        target_tokens=80,
        max_tokens=100,
        hard_max_tokens=100,
        overlap_tokens=10,
    ).chunk_text(text)

    assert len(chunks) == 2
    assert chunks[0].heading_path == ["Học phí"]
    assert chunks[0].kind == "mixed"
    assert chunks[1].heading_path == ["Lịch học"]
    assert all(chunk.tokens <= 100 for chunk in chunks)


def test_legal_markdown_and_chunks_preserve_document_order_and_metadata() -> None:
    parsed = ParsedPDF(
        pages=[
            PDFPage(
                page_number=1,
                text=(
                    "QUY CHẾ ĐÀO TẠO\n"
                    "Số: 123/QĐ-HVN\n"
                    "Hà Nội, ngày 10 tháng 8 năm 2026\n"
                    "Điều 1. Phạm vi áp dụng\n"
                    "1. Quy định này áp dụng cho sinh viên chính quy."
                ),
                char_count=150,
            ),
            PDFPage(
                page_number=2,
                text=(
                    "Điều 2. Đăng ký học phần\n"
                    "1. Sinh viên đăng ký học phần theo kế hoạch.\n"
                    "Văn bản có hiệu lực kể từ ngày 15 tháng 8 năm 2026."
                ),
                char_count=140,
                source="ocr",
                ocr_confidence=0.96,
            ),
        ],
        total_pages=2,
        total_chars=290,
        parser_used="hybrid",
        ocr_page_count=1,
        ocr_confidence=0.96,
        ocr_confidence_min=0.96,
    )

    artifact = build_legal_markdown(parsed, {"title": "Quy chế đào tạo"})
    chunks = DocumentChunker(
        min_tokens=10,
        target_tokens=45,
        max_tokens=70,
        hard_max_tokens=90,
        overlap_tokens=8,
    ).chunk_markdown(artifact.content, artifact.metadata)

    assert "<!-- page: 1; source: native_text -->" in artifact.content
    assert "<!-- page: 2; source: ocr; confidence: 0.9600 -->" in artifact.content
    assert artifact.metadata["document_number"] == "123/QĐ-HVN"
    assert artifact.metadata["issued_date"] == "2026-08-10"
    assert artifact.metadata["valid_from"] == "2026-08-15"
    assert [chunk.chunk_index for chunk in chunks] == list(range(len(chunks)))
    assert all(not ("Điều 1" in chunk.content and "Điều 2" in chunk.content) for chunk in chunks)
    assert any(chunk.article == "Điều 2. Đăng ký học phần" and chunk.contains_ocr for chunk in chunks)
    assert all(chunk.markdown_start_offset <= chunk.markdown_end_offset for chunk in chunks)
