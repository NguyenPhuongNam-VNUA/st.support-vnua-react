"""Unit coverage for deterministic PDF text cleanup and parser fallback order."""

from types import SimpleNamespace
from unittest.mock import patch

from core_ai.ingestion.pdf_parser import ParsedPDF, PDFPage, PDFParser


def test_pdf_text_cleanup_normalizes_whitespace_and_hyphenation() -> None:
    parser = PDFParser()
    cleaned = parser.clean_text("  Quy chế  đào tạo -\n liên thông\n\n\nMục 2  ")

    assert cleaned == "Quy chế đào tạo -\nliên thông\n\nMục 2"


def test_parser_uses_pdfplumber() -> None:
    parser = PDFParser()
    primary = ParsedPDF(
        pages=[PDFPage(page_number=1, text="Quy chế", char_count=7)],
        total_pages=1,
        total_chars=7,
        parser_used="pdfplumber",
    )

    with patch.object(parser, "_parse_with_pdfplumber", return_value=primary):
        result = parser.parse(b"not-read-because-engines-are-mocked")

    assert result is primary


def test_tesseract_ocr_keeps_reading_order_and_confidence() -> None:
    parser = PDFParser()
    page = SimpleNamespace(
        to_image=lambda **_: SimpleNamespace(
            original=SimpleNamespace(save=lambda output, **__: output.write(b"PNG"))
        )
    )
    tsv = """level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext
5\t1\t1\t1\t1\t1\t10\t10\t40\t12\t96\tĐiều
5\t1\t1\t1\t1\t2\t55\t10\t10\t12\t94\t1
5\t1\t1\t1\t2\t1\t10\t30\t45\t12\t92\tNội
5\t1\t1\t1\t2\t2\t60\t30\t50\t12\t90\tdung
"""

    with patch(
        "core_ai.ingestion.pdf_parser.subprocess.run",
        return_value=SimpleNamespace(returncode=0, stdout=tsv.encode(), stderr=b""),
    ) as run:
        text, confidence, blocks = parser._extract_ocr(page, 1)

    assert text == "Điều 1\nNội dung"
    assert confidence == 0.93
    assert [block.block_order for block in blocks] == [1, 2]
    assert all(block.source == "ocr" for block in blocks)
    assert run.call_args.args[0][:3] == ["tesseract", "stdin", "stdout"]
    assert "vie+eng" in run.call_args.args[0]


def test_markdown_table_keeps_wrapped_cells_on_one_row() -> None:
    table = [
        ["Mức học bổng (đồng/tháng)\nNgành", "Khá", "Giỏi", "Xuất sắc"],
        ["Thú y", "1.980.000", "2.100.000", "2.300.000"],
        ["Sinh học, CNSTH, Môi trường, Điện, Cơ\nkhí, CNTT", "1.600.000", "1.700.000", "1.900.000"],
    ]

    lines = PDFParser._markdown_table(table).splitlines()

    assert len(lines) == 4
    assert all(line.startswith("|") and line.endswith("|") for line in lines)
    assert lines[0] == "| Mức học bổng (đồng/tháng) Ngành | Khá | Giỏi | Xuất sắc |"
    assert lines[3] == "| Sinh học, CNSTH, Môi trường, Điện, Cơ khí, CNTT | 1.600.000 | 1.700.000 | 1.900.000 |"
