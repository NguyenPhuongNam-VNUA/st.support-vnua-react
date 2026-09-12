"""Deterministic PDF text extraction with page-level Vietnamese OCR fallback."""

from __future__ import annotations

import csv
import io
import logging
import re
import subprocess
import unicodedata
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, BinaryIO, List, Optional, Union

logger = logging.getLogger("core_ai.ingestion.pdf_parser")


@dataclass
class PDFBlock:
    """Ordered text block retained for provenance and reading-order checks."""

    page_number: int
    block_order: int
    text: str
    block_type: str = "paragraph"
    bbox: Optional[List[float]] = None
    source: str = "native_text"
    ocr_confidence: Optional[float] = None


@dataclass
class PDFPage:
    """Represents text and metadata extracted from a single PDF page."""

    page_number: int
    text: str
    char_count: int
    tables_found: int = 0
    heading: Optional[str] = None
    ocr_confidence: Optional[float] = None
    source: str = "native_text"
    blocks: List[PDFBlock] = field(default_factory=list)


@dataclass
class ParsedPDF:
    """Consolidated result of deterministic native/OCR extraction."""

    pages: List[PDFPage] = field(default_factory=list)
    total_pages: int = 0
    total_chars: int = 0
    parser_used: str = "unknown"
    ocr_confidence: Optional[float] = None
    ocr_page_count: int = 0
    ocr_confidence_min: Optional[float] = None

    @property
    def full_text(self) -> str:
        return "\n\n".join(
            f"--- [Trang {page.page_number}] ---\n{page.text}"
            for page in self.pages
            if page.text.strip()
        )


class PDFParser:
    """Extract page text with pdfplumber and use local Tesseract only when needed."""

    def __init__(
        self,
        preserve_tables: bool = True,
        max_pages: int = 200,
        native_text_min_chars: int = 80,
        ocr_timeout_seconds: float = 45.0,
        ocr_languages: str = "vie+eng",
    ) -> None:
        self.preserve_tables = preserve_tables
        self.max_pages = max_pages
        self.native_text_min_chars = native_text_min_chars
        self.ocr_timeout_seconds = ocr_timeout_seconds
        self.ocr_languages = ocr_languages

    def clean_text(self, raw_text: str) -> str:
        """Normalize extraction noise without rewriting legal wording."""
        if not raw_text:
            return ""

        normalized = unicodedata.normalize("NFC", raw_text)
        # Preserve legal dashes and bullets; join only words hyphenated at a line break.
        dehyphenated = re.sub(r"(?<=\w)-\s*\n\s*(?=\w)", "", normalized)
        lines = [re.sub(r"[ \t]+", " ", line).strip() for line in dehyphenated.splitlines()]
        cleaned = "\n".join(lines)
        cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
        return cleaned.strip()

    def _native_text_is_usable(self, text: str) -> bool:
        compact = "".join(text.split())
        if len(compact) < self.native_text_min_chars:
            return False
        replacement_ratio = text.count("\ufffd") / max(1, len(text))
        alphanumeric_ratio = sum(char.isalnum() for char in text) / max(1, len(text))
        return replacement_ratio <= 0.01 and alphanumeric_ratio >= 0.25

    @staticmethod
    def _markdown_table(table: List[List[Any]]) -> str:
        rows = [
            [str(cell or "").replace("|", "\\|").strip() for cell in row]
            for row in table
            if any(cell for cell in row)
        ]
        if not rows:
            return ""
        width = max(len(row) for row in rows)
        padded = [row + [""] * (width - len(row)) for row in rows]
        header = f"| {' | '.join(padded[0])} |"
        separator = f"| {' | '.join(['---'] * width)} |"
        body = [f"| {' | '.join(row)} |" for row in padded[1:]]
        return "\n".join([header, separator, *body])

    def _extract_native(self, page: Any, page_number: int) -> tuple[str, List[PDFBlock]]:
        raw_text = page.extract_text(use_text_flow=True) or ""
        cleaned = self.clean_text(raw_text)
        blocks = [
            PDFBlock(
                page_number=page_number,
                block_order=index,
                text=paragraph,
                source="native_text",
            )
            for index, paragraph in enumerate(
                (part.strip() for part in re.split(r"\n{2,}", cleaned)), start=1
            )
            if paragraph
        ]
        return cleaned, blocks

    def _extract_ocr(self, page: Any, page_number: int) -> tuple[str, float, List[PDFBlock]]:
        """Render one page in memory and parse Tesseract TSV without a shell."""
        image = page.to_image(resolution=300, antialias=True).original
        image_bytes = io.BytesIO()
        image.save(image_bytes, format="PNG")
        result = subprocess.run(
            [
                "tesseract",
                "stdin",
                "stdout",
                "-l",
                self.ocr_languages,
                "--psm",
                "3",
                "tsv",
            ],
            input=image_bytes.getvalue(),
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            check=False,
            timeout=self.ocr_timeout_seconds,
        )
        if result.returncode != 0:
            raise RuntimeError("Tesseract failed to extract page text")

        grouped: dict[tuple[int, int, int, int], List[dict[str, Any]]] = {}
        confidences: List[float] = []
        reader = csv.DictReader(
            io.StringIO(result.stdout.decode("utf-8", errors="replace")), delimiter="\t"
        )
        for row in reader:
            text = str(row.get("text") or "").strip()
            if not text:
                continue
            try:
                confidence = float(row.get("conf") or -1)
                block_num = int(row.get("block_num") or 0)
                par_num = int(row.get("par_num") or 0)
                line_num = int(row.get("line_num") or 0)
                top = int(row.get("top") or 0)
                left = int(row.get("left") or 0)
                width = int(row.get("width") or 0)
                height = int(row.get("height") or 0)
            except (TypeError, ValueError):
                continue
            if confidence >= 0:
                confidences.append(confidence)
            key = (block_num, par_num, line_num, top)
            grouped.setdefault(key, []).append(
                {
                    "text": text,
                    "confidence": confidence,
                    "left": left,
                    "top": top,
                    "right": left + width,
                    "bottom": top + height,
                }
            )

        blocks: List[PDFBlock] = []
        for block_order, (_, words) in enumerate(
            sorted(grouped.items(), key=lambda item: item[0]), start=1
        ):
            ordered_words = sorted(words, key=lambda word: word["left"])
            line = self.clean_text(" ".join(word["text"] for word in ordered_words))
            if not line:
                continue
            valid_confidences = [
                word["confidence"] for word in ordered_words if word["confidence"] >= 0
            ]
            line_confidence = (
                sum(valid_confidences) / len(valid_confidences) / 100
                if valid_confidences
                else 0.0
            )
            blocks.append(
                PDFBlock(
                    page_number=page_number,
                    block_order=block_order,
                    text=line,
                    bbox=[
                        float(min(word["left"] for word in ordered_words)),
                        float(min(word["top"] for word in ordered_words)),
                        float(max(word["right"] for word in ordered_words)),
                        float(max(word["bottom"] for word in ordered_words)),
                    ],
                    source="ocr",
                    ocr_confidence=round(line_confidence, 4),
                )
            )

        text = self.clean_text("\n".join(block.text for block in blocks))
        if not text:
            raise RuntimeError("Tesseract returned no usable text")
        confidence = sum(confidences) / len(confidences) / 100 if confidences else 0.0
        return text, round(confidence, 4), blocks

    def parse(self, source: Union[str, Path, bytes, BinaryIO]) -> ParsedPDF:
        file_path: Optional[str] = None
        pdf_bytes: Optional[bytes] = None

        if isinstance(source, (str, Path)):
            path_obj = Path(source)
            if not path_obj.exists():
                raise ValueError("PDF source does not exist")
            file_path = str(path_obj)
        elif isinstance(source, bytes):
            pdf_bytes = source
        elif hasattr(source, "read"):
            pdf_bytes = source.read()
        else:
            raise ValueError("Unsupported PDF source type")

        parsed = self._parse_with_pdfplumber(file_path=file_path, pdf_bytes=pdf_bytes)
        if not parsed.pages or parsed.total_chars == 0:
            raise ValueError("PDF contains no extractable text")
        return parsed

    def _parse_with_pdfplumber(
        self,
        file_path: Optional[str] = None,
        pdf_bytes: Optional[bytes] = None,
    ) -> ParsedPDF:
        import pdfplumber

        stream = open(file_path, "rb") if file_path else io.BytesIO(pdf_bytes or b"")
        try:
            with pdfplumber.open(stream) as pdf:
                if len(pdf.pages) > self.max_pages:
                    raise ValueError("PDF exceeds configured page limit")

                pages: List[PDFPage] = []
                ocr_confidences: List[float] = []
                for page_number, page in enumerate(pdf.pages, start=1):
                    native_text, native_blocks = self._extract_native(page, page_number)
                    page_text = native_text
                    blocks = native_blocks
                    page_source = "native_text"
                    page_ocr_confidence: Optional[float] = None

                    if not self._native_text_is_usable(native_text):
                        try:
                            page_text, page_ocr_confidence, blocks = self._extract_ocr(
                                page, page_number
                            )
                            page_source = "ocr"
                            ocr_confidences.append(page_ocr_confidence)
                        except (OSError, RuntimeError, subprocess.SubprocessError) as exc:
                            if not native_text:
                                logger.warning(
                                    "OCR failed for empty page %d: %s",
                                    page_number,
                                    type(exc).__name__,
                                )
                            else:
                                logger.warning(
                                    "OCR failed for page %d; retaining native text: %s",
                                    page_number,
                                    type(exc).__name__,
                                )

                    tables_found = 0
                    if self.preserve_tables and page_source == "native_text":
                        tables = page.extract_tables() or []
                        formatted_tables = [self._markdown_table(table) for table in tables if table]
                        formatted_tables = [table for table in formatted_tables if table]
                        tables_found = len(formatted_tables)
                        if formatted_tables:
                            table_text = "\n\n".join(formatted_tables)
                            page_text = f"{page_text}\n\n[Bảng dữ liệu trích xuất]:\n{table_text}"
                            blocks.append(
                                PDFBlock(
                                    page_number=page_number,
                                    block_order=len(blocks) + 1,
                                    text=table_text,
                                    block_type="table",
                                    source="native_text",
                                )
                            )

                    cleaned = self.clean_text(page_text)
                    pages.append(
                        PDFPage(
                            page_number=page_number,
                            text=cleaned,
                            char_count=len(cleaned),
                            tables_found=tables_found,
                            ocr_confidence=page_ocr_confidence,
                            source=page_source,
                            blocks=blocks,
                        )
                    )

                total_chars = sum(page.char_count for page in pages)
                ocr_page_count = sum(page.source == "ocr" for page in pages)
                parser_used = (
                    "hybrid"
                    if 0 < ocr_page_count < len(pages)
                    else "tesseract-ocr"
                    if ocr_page_count == len(pages) and pages
                    else "pdfplumber"
                )
                ocr_average = (
                    round(sum(ocr_confidences) / len(ocr_confidences), 4)
                    if ocr_confidences
                    else None
                )
                ocr_minimum = round(min(ocr_confidences), 4) if ocr_confidences else None
                logger.info(
                    "Parsed %d pages (%d chars, %d OCR pages) with %s",
                    len(pages),
                    total_chars,
                    ocr_page_count,
                    parser_used,
                )
                return ParsedPDF(
                    pages=pages,
                    total_pages=len(pages),
                    total_chars=total_chars,
                    parser_used=parser_used,
                    ocr_confidence=ocr_average,
                    ocr_page_count=ocr_page_count,
                    ocr_confidence_min=ocr_minimum,
                )
        finally:
            if file_path and not stream.closed:
                stream.close()
