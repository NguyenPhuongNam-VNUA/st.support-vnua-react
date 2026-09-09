"""PDF parser using single pdfplumber engine for ST-Care Ingestion Pipeline."""

import io
import logging
import re
import unicodedata
from dataclasses import dataclass, field
from pathlib import Path
from typing import BinaryIO, List, Optional, Union

logger = logging.getLogger("core_ai.ingestion.pdf_parser")


@dataclass
class PDFPage:
    """Represents text and metadata extracted from a single PDF page."""

    page_number: int  # 1-based page index
    text: str
    char_count: int
    tables_found: int = 0
    heading: Optional[str] = None
    ocr_confidence: Optional[float] = None


@dataclass
class ParsedPDF:
    """Consolidated result of a completed PDF extraction."""

    pages: List[PDFPage] = field(default_factory=list)
    total_pages: int = 0
    total_chars: int = 0
    parser_used: str = "unknown"
    ocr_confidence: Optional[float] = None

    @property
    def full_text(self) -> str:
        """Concatenates all pages with page marker headers."""
        return "\n\n".join(
            f"--- [Trang {p.page_number}] ---\n{p.text}" for p in self.pages if p.text.strip()
        )


class PDFParser:
    """Extracts text page-by-page from PDF files or raw binary byte streams."""

    def __init__(self, preserve_tables: bool = True, max_pages: int = 200) -> None:
        self.preserve_tables = preserve_tables
        self.max_pages = max_pages

    def clean_text(self, raw_text: str) -> str:
        """Cleans and normalizes extracted page text."""
        if not raw_text:
            return ""

        # 1. Unicode NFC normalization
        normalized = unicodedata.normalize("NFC", raw_text)

        # 2. Re-join hyphenated words split across line breaks (e.g. "đào tạo -\n theo" -> "đào tạo theo")
        dehyphenated = re.sub(r"(\w+)\s*-\s*\n\s*(\w+)", r"\1\2", normalized)

        # 3. Collapse consecutive whitespace within lines while keeping paragraphs
        lines = [re.sub(r"[ \t]+", " ", line).strip() for line in dehyphenated.splitlines()]
        cleaned = "\n".join(lines)

        # 4. Collapse more than two consecutive empty lines into double newlines
        cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
        return cleaned.strip()

    def parse(self, source: Union[str, Path, bytes, BinaryIO]) -> ParsedPDF:
        """Parses a PDF using pdfplumber."""
        file_path: Optional[str] = None
        pdf_bytes: Optional[bytes] = None

        if isinstance(source, (str, Path)):
            path_obj = Path(source)
            if not path_obj.exists():
                raise FileNotFoundError(f"PDF file does not exist: {source}")
            file_path = str(path_obj)
        elif isinstance(source, bytes):
            pdf_bytes = source
        elif hasattr(source, "read"):
            pdf_bytes = source.read()
        else:
            raise ValueError(f"Unsupported PDF source type: {type(source)}")

        parsed = self._parse_with_pdfplumber(file_path=file_path, pdf_bytes=pdf_bytes)
        if parsed.total_chars == 0:
            raise ValueError("PDF contains no extractable text")
        return parsed

    def _parse_with_pdfplumber(
        self,
        file_path: Optional[str] = None,
        pdf_bytes: Optional[bytes] = None,
    ) -> ParsedPDF:
        """Primary extraction using pdfplumber."""
        import pdfplumber  # type: ignore

        stream = open(file_path, "rb") if file_path else io.BytesIO(pdf_bytes or b"")
        try:
            with pdfplumber.open(stream) as pdf:
                if len(pdf.pages) > self.max_pages:
                    raise ValueError("PDF exceeds configured page limit")
                pages: List[PDFPage] = []
                total_chars = 0

                for i, page in enumerate(pdf.pages, start=1):
                    page_text = page.extract_text() or ""
                    tables_count = 0

                    if self.preserve_tables:
                        tables = page.extract_tables() or []
                        tables_count = len(tables)
                        if tables:
                            formatted_tables: List[str] = []
                            for tbl in tables:
                                if not tbl:
                                    continue
                                rows_str = [
                                    " | ".join(str(cell or "").strip() for cell in row)
                                    for row in tbl
                                    if any(cell for cell in row)
                                ]
                                if rows_str:
                                    formatted_tables.append("\n".join(rows_str))
                            if formatted_tables:
                                page_text += "\n\n[Bảng dữ liệu trích xuất]:\n" + "\n\n".join(
                                    formatted_tables
                                )

                    cleaned = self.clean_text(page_text)
                    c_count = len(cleaned)
                    total_chars += c_count

                    pages.append(
                        PDFPage(
                            page_number=i,
                            text=cleaned,
                            char_count=c_count,
                            tables_found=tables_count,
                        )
                    )

                logger.info(
                    "Parsed %d pages (%d chars) successfully with pdfplumber.",
                    len(pages),
                    total_chars,
                )
                return ParsedPDF(
                    pages=pages,
                    total_pages=len(pages),
                    total_chars=total_chars,
                    parser_used="pdfplumber",
                )
        finally:
            if file_path and not stream.closed:
                stream.close()
