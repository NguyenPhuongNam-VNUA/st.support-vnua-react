"""Unit coverage for deterministic PDF text cleanup and parser fallback order."""

from unittest.mock import patch

from core_ai.ingestion.pdf_parser import ParsedPDF, PDFPage, PDFParser


def test_pdf_text_cleanup_normalizes_whitespace_and_hyphenation() -> None:
    parser = PDFParser()
    cleaned = parser.clean_text("  Quy chế  đào tạo -\n liên thông\n\n\nMục 2  ")

    assert cleaned == "Quy chế đào tạoliên thông\n\nMục 2"


def test_parser_uses_pypdf_when_primary_has_no_text() -> None:
    parser = PDFParser()
    primary = ParsedPDF(pages=[], total_pages=1, total_chars=0, parser_used="pdfplumber")
    fallback = ParsedPDF(
        pages=[PDFPage(page_number=1, text="Quy chế", char_count=7)],
        total_pages=1,
        total_chars=7,
        parser_used="pypdf",
    )

    with patch.object(parser, "_parse_with_pdfplumber", return_value=primary), patch.object(
        parser, "_parse_with_pypdf", return_value=fallback
    ):
        result = parser.parse(b"not-read-because-engines-are-mocked")

    assert result is fallback
