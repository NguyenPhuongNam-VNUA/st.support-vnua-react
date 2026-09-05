"""Heading-aware Vietnamese document chunking with isolated table provenance."""

from __future__ import annotations

import hashlib
import logging
import re
from dataclasses import dataclass, field
from typing import List

from core_ai.ingestion.pdf_parser import ParsedPDF, PDFPage

logger = logging.getLogger("core_ai.ingestion.chunker")


@dataclass
class DocumentChunk:
    chunk_index: int
    page: int
    tokens: int
    content: str
    heading_path: List[str] = field(default_factory=list)
    content_hash: str = ""
    kind: str = "text"

    def __post_init__(self) -> None:
        if not self.content_hash:
            normalized = " ".join(self.content.lower().split())
            self.content_hash = hashlib.sha256(normalized.encode("utf-8")).hexdigest()


def estimate_tokens(text: str) -> int:
    if not text or not text.strip():
        return 0
    return max(1, int(len(text.split()) * 1.3), int(len(text) / 3.8))


@dataclass
class _Segment:
    text: str
    page: int
    heading_path: List[str]
    kind: str = "text"


class DocumentChunker:
    """Split Markdown/PDF text at headings, sentences and table boundaries."""

    _HEADING = re.compile(r"^(#{1,6})\s+(.+?)\s*$")
    _SENTENCE_BOUNDARY = re.compile(r"(?<=[.!?])\s+|\n{2,}")

    def __init__(
        self,
        min_tokens: int = 300,
        max_tokens: int = 600,
        target_tokens: int = 450,
        overlap_tokens: int = 80,
    ) -> None:
        self.min_tokens = min_tokens
        self.max_tokens = max_tokens
        self.target_tokens = target_tokens
        self.overlap_tokens = overlap_tokens

    def _page_segments(self, page: PDFPage, heading_stack: List[str]) -> List[_Segment]:
        segments: List[_Segment] = []
        paragraph: List[str] = []
        table: List[str] = []

        def flush_paragraph() -> None:
            if not paragraph:
                return
            body = "\n".join(paragraph).strip()
            paragraph.clear()
            for sentence in self._SENTENCE_BOUNDARY.split(body):
                if sentence.strip():
                    segments.append(
                        _Segment(sentence.strip(), page.page_number, list(heading_stack))
                    )

        def flush_table() -> None:
            if not table:
                return
            body = "\n".join(table).strip()
            table.clear()
            context = " > ".join(heading_stack)
            content = f"{context}\n\n{body}" if context else body
            segments.append(_Segment(content, page.page_number, list(heading_stack), "table"))

        for raw_line in page.text.splitlines():
            line = raw_line.strip()
            if not line:
                flush_paragraph()
                flush_table()
                continue
            heading = self._HEADING.match(line)
            if heading:
                flush_paragraph()
                flush_table()
                level = len(heading.group(1))
                title = heading.group(2).strip()
                del heading_stack[level - 1 :]
                heading_stack.append(title)
                continue
            is_table_line = line.count("|") >= 2 or line.startswith("[Bảng dữ liệu")
            if is_table_line:
                flush_paragraph()
                table.append(line)
            else:
                flush_table()
                paragraph.append(line)
        flush_paragraph()
        flush_table()
        return segments

    def _split_oversized(self, segment: _Segment) -> List[_Segment]:
        if estimate_tokens(segment.text) <= self.max_tokens:
            return [segment]
        words = segment.text.split()
        approx_words = max(30, int(self.max_tokens / 1.3))
        overlap_words = max(0, int(self.overlap_tokens / 1.3))
        step = max(1, approx_words - overlap_words)
        return [
            _Segment(
                " ".join(words[start : start + approx_words]),
                segment.page,
                segment.heading_path,
                segment.kind,
            )
            for start in range(0, len(words), step)
            if words[start : start + approx_words]
        ]

    def chunk_pdf(self, parsed_pdf: ParsedPDF) -> List[DocumentChunk]:
        heading_stack: List[str] = []
        raw_segments: List[_Segment] = []
        for page in parsed_pdf.pages:
            raw_segments.extend(self._page_segments(page, heading_stack))
        segments = [part for segment in raw_segments for part in self._split_oversized(segment)]
        if not segments:
            return []

        chunks: List[DocumentChunk] = []
        current: List[_Segment] = []
        current_tokens = 0

        def flush() -> None:
            nonlocal current, current_tokens
            if not current:
                return
            content = " ".join(item.text for item in current).strip()
            chunks.append(
                DocumentChunk(
                    chunk_index=len(chunks),
                    page=current[0].page,
                    tokens=estimate_tokens(content),
                    content=content,
                    heading_path=list(current[0].heading_path),
                    kind=current[0].kind
                    if all(x.kind == current[0].kind for x in current)
                    else "text",
                )
            )
            previous = current
            current = []
            current_tokens = 0
            if previous[-1].kind == "text":
                overlap: List[_Segment] = []
                overlap_size = 0
                for item in reversed(previous):
                    if item.heading_path != previous[-1].heading_path:
                        break
                    overlap.insert(0, item)
                    overlap_size += estimate_tokens(item.text)
                    if overlap_size >= self.overlap_tokens:
                        break
                current = overlap
                current_tokens = overlap_size

        for segment in segments:
            tokens = estimate_tokens(segment.text)
            boundary_changed = bool(
                current
                and (
                    segment.heading_path != current[0].heading_path
                    or segment.kind != current[0].kind
                )
            )
            if boundary_changed or (current and current_tokens + tokens > self.max_tokens):
                flush()
                if current and (
                    segment.heading_path != current[0].heading_path
                    or segment.kind != current[0].kind
                ):
                    current, current_tokens = [], 0
            current.append(segment)
            current_tokens += tokens
            if segment.kind == "table" or current_tokens >= self.target_tokens:
                flush()
        flush()

        # Remove an overlap-only duplicate tail.
        if len(chunks) > 1 and chunks[-1].content_hash == chunks[-2].content_hash:
            chunks.pop()
        for index, chunk in enumerate(chunks):
            chunk.chunk_index = index
        logger.info("Created %d heading-aware chunks", len(chunks))
        return chunks

    def chunk_text(self, text: str, page_number: int = 1) -> List[DocumentChunk]:
        return self.chunk_pdf(
            ParsedPDF(
                pages=[PDFPage(page_number=page_number, text=text, char_count=len(text))],
                total_pages=1,
                total_chars=len(text),
                parser_used="direct_text",
            )
        )
