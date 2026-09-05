"""PDF parser with robust multi-engine fallback for ST-Care Ingestion Pipeline.

Supports extracting clean, structured text page-by-page from:
1. Primary engine: `pdfplumber` (preserves page geometry and table contents).
2. Secondary fallback: `pypdf` (fast, pure-python fallback if pdfplumber is unavailable or fails).
"""

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
        """Parses a PDF from file path, bytes, or binary stream with automatic engine fallback."""
        # 1. Prepare byte buffer or path
        pdf_bytes: Optional[bytes] = None
        file_path: Optional[str] = None

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

        # Attempt 1: structure-aware Markdown extraction.
        try:
            parsed = self._parse_with_pymupdf4llm(file_path=file_path, pdf_bytes=pdf_bytes)
            if parsed.total_chars > 0:
                return parsed
        except Exception as exc:
            logger.warning("PyMuPDF4LLM parser unavailable/failed (%s); using pdfplumber", exc)

        # Attempt 2: Try pdfplumber
        try:
            parsed = self._parse_with_pdfplumber(file_path=file_path, pdf_bytes=pdf_bytes)
            if parsed.total_chars > 0:
                return parsed
            raise ValueError("PDF contains no extractable text")
        except Exception as exc:
            logger.warning(
                "Primary parser pdfplumber failed (%s). Falling back to pypdf...",
                exc,
            )

        # Attempt 3: Fallback to pypdf
        try:
            parsed = self._parse_with_pypdf(file_path=file_path, pdf_bytes=pdf_bytes)
            if parsed.total_chars > 0:
                return parsed
            raise ValueError("PDF contains no extractable text")
        except Exception as exc:
            logger.warning("Secondary parser pypdf failed (%s). Falling back to OCR...", exc)

        try:
            return self._parse_with_ocr(file_path=file_path, pdf_bytes=pdf_bytes)
        except Exception as exc:
            logger.error("OCR fallback also failed: %s", exc, exc_info=True)
            raise RuntimeError(f"Failed to extract text from PDF: {exc}") from exc

    def _parse_with_pymupdf4llm(
        self,
        file_path: Optional[str] = None,
        pdf_bytes: Optional[bytes] = None,
    ) -> ParsedPDF:
        """Extract Markdown page chunks while preserving headings and tables."""
        import fitz  # type: ignore
        import pymupdf4llm  # type: ignore

        document = fitz.open(file_path) if file_path else fitz.open(stream=pdf_bytes, filetype="pdf")
        try:
            if document.page_count > self.max_pages:
                raise ValueError("PDF exceeds configured page limit")
            rows = pymupdf4llm.to_markdown(document, page_chunks=True)
            pages: List[PDFPage] = []
            total_chars = 0
            for index, row in enumerate(rows, start=1):
                text = self.clean_text(str(row.get("text", "")))
                metadata = row.get("metadata") or {}
                page_number = int(metadata.get("page", index - 1)) + 1
                heading_match = re.search(r"(?m)^#{1,6}\s+(.+)$", text)
                total_chars += len(text)
                pages.append(
                    PDFPage(
                        page_number=page_number,
                        text=text,
                        char_count=len(text),
                        tables_found=text.count("|---"),
                        heading=heading_match.group(1).strip() if heading_match else None,
                    )
                )
            return ParsedPDF(
                pages=pages,
                total_pages=len(pages),
                total_chars=total_chars,
                parser_used="pymupdf4llm",
            )
        finally:
            document.close()

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

                    # Extract table content if requested and append to page text
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

    def _parse_with_pypdf(
        self,
        file_path: Optional[str] = None,
        pdf_bytes: Optional[bytes] = None,
    ) -> ParsedPDF:
        """Secondary fallback extraction using pypdf."""
        import pypdf  # type: ignore

        stream = open(file_path, "rb") if file_path else io.BytesIO(pdf_bytes or b"")
        try:
            reader = pypdf.PdfReader(stream)
            if len(reader.pages) > self.max_pages:
                raise ValueError("PDF exceeds configured page limit")
            pages: List[PDFPage] = []
            total_chars = 0

            for i, page in enumerate(reader.pages, start=1):
                raw_text = page.extract_text() or ""
                cleaned = self.clean_text(raw_text)
                c_count = len(cleaned)
                total_chars += c_count

                pages.append(
                    PDFPage(
                        page_number=i,
                        text=cleaned,
                        char_count=c_count,
                        tables_found=0,
                    )
                )

            logger.info(
                "Parsed %d pages (%d chars) successfully with pypdf fallback.",
                len(pages),
                total_chars,
            )
            return ParsedPDF(
                pages=pages,
                total_pages=len(pages),
                total_chars=total_chars,
                parser_used="pypdf",
            )
        finally:
            if file_path and not stream.closed:
                stream.close()

    def _parse_with_ocr(
        self,
        file_path: Optional[str] = None,
        pdf_bytes: Optional[bytes] = None,
    ) -> ParsedPDF:
        """OCR scanned PDFs locally with PyMuPDF and Tesseract (Vietnamese + English)."""
        import fitz  # type: ignore
        import pytesseract  # type: ignore
        from PIL import Image  # type: ignore

        document = fitz.open(file_path) if file_path else fitz.open(stream=pdf_bytes, filetype="pdf")
        try:
            if document.page_count > self.max_pages:
                raise ValueError("PDF exceeds configured page limit")
            pages: List[PDFPage] = []
            total_chars = 0
            confidences: List[float] = []
            for index in range(document.page_count):
                page = document.load_page(index)
                pixmap = page.get_pixmap(matrix=fitz.Matrix(2.0, 2.0), alpha=False)
                image = Image.frombytes("RGB", (pixmap.width, pixmap.height), pixmap.samples)
                data = pytesseract.image_to_data(
                    image, lang="vie+eng", output_type=pytesseract.Output.DICT
                )
                raw_conf = [float(value) for value in data.get("conf", []) if float(value) >= 0]
                page_confidence = (sum(raw_conf) / len(raw_conf) / 100.0) if raw_conf else 0.0
                confidences.append(page_confidence)
                text = self.clean_text(" ".join(data.get("text", [])))
                total_chars += len(text)
                pages.append(
                    PDFPage(
                        page_number=index + 1,
                        text=text,
                        char_count=len(text),
                        ocr_confidence=page_confidence,
                    )
                )
            if total_chars == 0:
                raise ValueError("OCR produced no text")
            return ParsedPDF(
                pages=pages,
                total_pages=len(pages),
                total_chars=total_chars,
                parser_used="tesseract-ocr",
                ocr_confidence=sum(confidences) / len(confidences) if confidences else 0.0,
            )
        finally:
            document.close()
