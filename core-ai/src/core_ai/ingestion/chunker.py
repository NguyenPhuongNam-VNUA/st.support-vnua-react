"""Deterministic legal Markdown builder and structure-aware semantic chunker."""

from __future__ import annotations

import hashlib
import json
import logging
import re
import unicodedata
from collections import Counter
from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Any, Dict, List, Optional

from core_ai.ingestion.pdf_parser import ParsedPDF, PDFPage

logger = logging.getLogger("core_ai.ingestion.chunker")

CHUNKING_VERSION = "legal-semantic-v1"
EXTRACTION_VERSION = "legal-md-v1"

_PAGE_MARKER = re.compile(
    r"^<!--\s*page:\s*(\d+)(?:;\s*source:\s*([\w_-]+))?(?:;\s*confidence:\s*([0-9.]+))?\s*-->$",
    re.IGNORECASE,
)
_HEADING = re.compile(r"^(#{1,6})\s+(.+?)\s*$")
_PART = re.compile(r"^(?:PHẦN|Phần)\s+(?:THỨ\s+)?[\wIVXLCDM.-]+\b.*", re.IGNORECASE)
_CHAPTER = re.compile(r"^(?:CHƯƠNG|Chương)\s+[\wIVXLCDM.-]+\b.*", re.IGNORECASE)
_SECTION = re.compile(r"^(?:MỤC|Mục)\s+[\wIVXLCDM.-]+\b.*", re.IGNORECASE)
_ARTICLE = re.compile(r"^(?:ĐIỀU|Điều)\s+\d+[\w.-]*\b.*", re.IGNORECASE)
_APPENDIX = re.compile(r"^(?:PHỤ\s+LỤC|Phụ\s+lục)\b.*", re.IGNORECASE)
_CLAUSE = re.compile(r"^(\d{1,3})[.)]\s+", re.UNICODE)
_POINT = re.compile(r"^([a-zA-ZđĐ])\)\s+", re.UNICODE)
_SENTENCE_BOUNDARY = re.compile(r"(?<=[.!?;:])\s+")
_DOCUMENT_NUMBER = re.compile(
    r"\b(?:Số\s*[:：]?\s*)?(\d{1,4}/(?:QĐ|TB|HD|CV|KH|QC|CT|NQ)-[A-ZÀ-Ỹ0-9-]+)\b",
    re.IGNORECASE,
)
_VI_DATE = re.compile(r"ngày\s+(\d{1,2})\s+tháng\s+(\d{1,2})\s+năm\s+(\d{4})", re.IGNORECASE)
_SLASH_DATE = re.compile(r"\b(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b")
_EFFECTIVE_VI_DATE = re.compile(
    r"(?:có\s+)?hiệu\s+lực(?:\s+thi\s+hành)?(?:\s+kể\s+từ)?\s+ngày\s+"
    r"(\d{1,2})\s+tháng\s+(\d{1,2})\s+năm\s+(\d{4})",
    re.IGNORECASE,
)
_MONEY = re.compile(r"\b\d[\d.,]*\s*(?:đồng|VND|₫)\b", re.IGNORECASE)
_LEGAL_REFERENCE = re.compile(
    r"\b(?:Luật|Nghị định|Thông tư|Quyết định)\s+(?:số\s+)?[\w./-]+",
    re.IGNORECASE,
)

_STOPWORDS = {
    "và", "của", "các", "cho", "được", "theo", "trong", "với", "một", "những",
    "này", "đó", "khi", "tại", "từ", "đến", "về", "là", "có", "không", "hoặc",
    "đối", "sinh", "viên", "học", "viện", "quy", "định", "điều", "khoản",
}

_TOPIC_TAXONOMY: Dict[str, tuple[str, ...]] = {
    "hoc_phi": ("học phí", "lệ phí", "mức thu", "miễn giảm"),
    "dang_ky_hoc_phan": ("đăng ký học phần", "đăng ký môn", "tín chỉ"),
    "hoc_bong": ("học bổng", "khuyến khích học tập"),
    "tot_nghiep": ("tốt nghiệp", "chuẩn đầu ra", "khóa luận"),
    "thi_kiem_tra": ("thi", "kiểm tra", "phúc khảo", "điểm"),
    "bao_luu": ("bảo lưu", "tạm dừng học", "nghỉ học"),
    "ky_tuc_xa": ("ký túc xá", "nội trú"),
}

_SEARCH_ALIASES: Dict[str, tuple[str, ...]] = {
    "dang_ky_hoc_phan": ("đăng ký môn", "đăng ký tín chỉ"),
    "hoc_phi": ("tiền học", "tiền tín chỉ"),
    "thi_kiem_tra": ("lịch thi", "điểm thi"),
}


def estimate_tokens(text: str) -> int:
    if not text or not text.strip():
        return 0
    return max(1, int(len(text.split()) * 1.3), int(len(text) / 3.8))


def _plain(value: Any) -> Any:
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    return value


def _normalized(text: str) -> str:
    return unicodedata.normalize("NFC", " ".join(text.lower().split()))


def _extract_topics(text: str) -> List[str]:
    normalized = _normalized(text)
    return [
        topic
        for topic, phrases in _TOPIC_TAXONOMY.items()
        if any(phrase in normalized for phrase in phrases)
    ]


def _extract_keywords(text: str, limit: int = 12) -> List[str]:
    words = re.findall(r"[\wÀ-ỹ]{3,}", _normalized(text), flags=re.UNICODE)
    counts = Counter(word for word in words if word not in _STOPWORDS and not word.isdigit())
    return [word for word, _ in counts.most_common(limit)]


def _extract_entities(text: str) -> Dict[str, List[str]]:
    return {
        "dates": list(dict.fromkeys(match.group(0) for match in _SLASH_DATE.finditer(text))),
        "monetary_values": list(dict.fromkeys(match.group(0) for match in _MONEY.finditer(text))),
        "legal_references": list(
            dict.fromkeys(match.group(0) for match in _LEGAL_REFERENCE.finditer(text))
        ),
    }


@dataclass
class MarkdownArtifact:
    content: str
    sha256: str
    metadata: Dict[str, Any]


@dataclass
class DocumentChunk:
    chunk_index: int
    page: int
    tokens: int
    content: str
    heading_path: List[str] = field(default_factory=list)
    content_hash: str = ""
    kind: str = "text"
    search_text: str = ""
    page_end: Optional[int] = None
    part: Optional[str] = None
    chapter: Optional[str] = None
    section: Optional[str] = None
    article: Optional[str] = None
    clause: Optional[str] = None
    point: Optional[str] = None
    semantic_topics: List[str] = field(default_factory=list)
    keywords: List[str] = field(default_factory=list)
    entities: Dict[str, Any] = field(default_factory=dict)
    markdown_start_offset: Optional[int] = None
    markdown_end_offset: Optional[int] = None
    is_complete_semantic_unit: bool = True
    split_reason: str = "semantic_boundary"
    contains_ocr: bool = False
    ocr_confidence_min: Optional[float] = None
    metadata: Dict[str, Any] = field(default_factory=dict)

    def __post_init__(self) -> None:
        self.page_end = self.page if self.page_end is None else self.page_end
        if not self.search_text:
            breadcrumb = " > ".join(self.heading_path)
            self.search_text = f"{breadcrumb}\n{self.content}".strip()
        if not self.content_hash:
            self.content_hash = hashlib.sha256(
                _normalized(self.search_text).encode("utf-8")
            ).hexdigest()


@dataclass
class _Segment:
    text: str
    page: int
    page_end: int
    heading_path: List[str]
    kind: str = "text"
    part: Optional[str] = None
    chapter: Optional[str] = None
    section: Optional[str] = None
    article: Optional[str] = None
    clause: Optional[str] = None
    point: Optional[str] = None
    markdown_start_offset: Optional[int] = None
    markdown_end_offset: Optional[int] = None
    contains_ocr: bool = False
    ocr_confidence: Optional[float] = None
    complete: bool = True
    split_reason: str = "semantic_boundary"


def _heading_level(line: str) -> Optional[int]:
    if _PART.match(line):
        return 1
    if _CHAPTER.match(line) or _APPENDIX.match(line):
        return 2
    if _SECTION.match(line):
        return 3
    if _ARTICLE.match(line):
        return 4
    return None


def _document_type(title: str) -> str:
    lowered = _normalized(title)
    for value, phrase in (
        ("quy_che", "quy chế"),
        ("quyet_dinh", "quyết định"),
        ("thong_bao", "thông báo"),
        ("huong_dan", "hướng dẫn"),
        ("quy_trinh", "quy trình"),
        ("phu_luc", "phụ lục"),
    ):
        if phrase in lowered:
            return value
    return "other"


def enrich_document_metadata(text: str, supplied: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Fill only missing metadata with deterministic, evidence-backed extraction."""
    metadata = {key: _plain(value) for key, value in (supplied or {}).items() if value is not None}
    provenance = dict(metadata.get("metadata_provenance") or {})
    title = str(metadata.get("title") or "").strip()

    if not metadata.get("document_type") or metadata.get("document_type") == "other":
        metadata["document_type"] = _document_type(title or text[:300])

    number_match = _DOCUMENT_NUMBER.search(text[:5000])
    if not metadata.get("document_number") and number_match:
        metadata["document_number"] = number_match.group(1).upper()
        provenance["document_number"] = {
            "value_source": "regex_from_document",
            "source_text": number_match.group(0)[:200],
            "extraction_rule": "document_number_v1",
            "confidence": 0.98,
        }

    date_match = _VI_DATE.search(text[:5000]) or _SLASH_DATE.search(text[:5000])
    if not metadata.get("issued_date") and date_match:
        try:
            if date_match.re is _VI_DATE:
                day, month, year = map(int, date_match.groups())
            else:
                day, month, year = map(int, date_match.groups())
            metadata["issued_date"] = date(year, month, day).isoformat()
            provenance["issued_date"] = {
                "value_source": "regex_from_document",
                "source_text": date_match.group(0)[:200],
                "extraction_rule": "issued_date_v1",
                "confidence": 0.9,
            }
        except ValueError:
            pass

    effective_match = _EFFECTIVE_VI_DATE.search(text[:10000])
    if not metadata.get("valid_from") and effective_match:
        try:
            day, month, year = map(int, effective_match.groups())
            metadata["valid_from"] = date(year, month, day).isoformat()
            provenance["valid_from"] = {
                "value_source": "regex_from_document",
                "source_text": effective_match.group(0)[:200],
                "extraction_rule": "effective_date_v1",
                "confidence": 0.92,
            }
        except ValueError:
            pass

    metadata["semantic_topics"] = _extract_topics(text)
    metadata["metadata_provenance"] = provenance
    metadata["extraction_version"] = EXTRACTION_VERSION
    metadata["chunking_version"] = CHUNKING_VERSION
    return metadata


def build_legal_markdown(
    parsed_pdf: ParsedPDF,
    document_metadata: Optional[Dict[str, Any]] = None,
) -> MarkdownArtifact:
    """Build canonical Markdown without changing the source wording."""
    base_metadata = enrich_document_metadata(parsed_pdf.full_text, document_metadata)
    frontmatter_keys = (
        "document_id", "tenant_id", "title", "short_title", "document_number",
        "document_type", "issuer", "issuing_unit", "signed_by", "signed_date",
        "issued_date", "valid_from", "valid_to", "validity_status", "version",
        "academic_year", "semester", "audiences", "education_levels", "study_modes",
        "faculties", "programs", "campuses", "cohorts", "source_sha256",
        "extraction_version", "chunking_version",
    )
    frontmatter = ["---"]
    for key in frontmatter_keys:
        if key in base_metadata and base_metadata[key] not in (None, "", []):
            frontmatter.append(f"{key}: {json.dumps(_plain(base_metadata[key]), ensure_ascii=False)}")
    frontmatter.extend(["---", ""])

    output = frontmatter
    for page in sorted(parsed_pdf.pages, key=lambda item: item.page_number):
        marker = f"<!-- page: {page.page_number}; source: {page.source}"
        if page.ocr_confidence is not None:
            marker += f"; confidence: {page.ocr_confidence:.4f}"
        output.extend([f"{marker} -->", ""])

        paragraph: List[str] = []

        def flush_paragraph() -> None:
            if paragraph:
                output.extend([" ".join(paragraph).strip(), ""])
                paragraph.clear()

        in_table = False
        for raw_line in page.text.splitlines():
            line = raw_line.strip()
            if not line:
                flush_paragraph()
                in_table = False
                continue
            existing_heading = _HEADING.match(line)
            legal_level = _heading_level(line)
            is_table = line.startswith("|") and line.endswith("|")
            is_list = bool(_CLAUSE.match(line) or _POINT.match(line))
            if existing_heading or legal_level:
                flush_paragraph()
                output.extend([line if existing_heading else f"{'#' * legal_level} {line}", ""])
                in_table = False
            elif is_table:
                flush_paragraph()
                output.append(line)
                in_table = True
            elif line.startswith("[Bảng dữ liệu trích xuất]"):
                flush_paragraph()
                output.extend(["**Bảng dữ liệu trích xuất**", ""])
                in_table = False
            elif is_list:
                flush_paragraph()
                paragraph.append(line)
                in_table = False
            elif in_table:
                output.append(line)
            else:
                paragraph.append(line)
        flush_paragraph()

    content = "\n".join(output).strip() + "\n"
    return MarkdownArtifact(
        content=content,
        sha256=hashlib.sha256(content.encode("utf-8")).hexdigest(),
        metadata=base_metadata,
    )


class DocumentChunker:
    """Split canonical legal Markdown at structural semantic boundaries."""

    def __init__(
        self,
        min_tokens: int = 200,
        max_tokens: int = 900,
        target_tokens: int = 600,
        overlap_tokens: int = 80,
        hard_max_tokens: int = 1100,
    ) -> None:
        if not 0 < min_tokens <= target_tokens <= max_tokens <= hard_max_tokens:
            raise ValueError("Chunk limits must satisfy min <= target <= max <= hard max")
        if overlap_tokens < 0:
            raise ValueError("Chunk overlap must not be negative")
        self.min_tokens = min_tokens
        self.max_tokens = max_tokens
        self.target_tokens = target_tokens
        # Older callers only overrode target/max and relied on the former default
        # overlap. Clamp that default instead of rejecting an otherwise valid
        # configuration.
        self.overlap_tokens = min(overlap_tokens, max(0, target_tokens - 1))
        self.hard_max_tokens = hard_max_tokens

    def _split_oversized(self, segment: _Segment) -> List[_Segment]:
        if estimate_tokens(segment.text) <= self.hard_max_tokens:
            return [segment]

        sentences = [part.strip() for part in _SENTENCE_BOUNDARY.split(segment.text) if part.strip()]
        parts: List[str] = []
        current: List[str] = []
        current_tokens = 0
        for sentence in sentences or [segment.text]:
            sentence_tokens = estimate_tokens(sentence)
            if current and current_tokens + sentence_tokens > self.max_tokens:
                parts.append(" ".join(current))
                current, current_tokens = [], 0
            if sentence_tokens > self.hard_max_tokens:
                words = sentence.split()
                words_per_part = max(30, int(self.max_tokens / 1.3))
                for start in range(0, len(words), words_per_part):
                    if current:
                        parts.append(" ".join(current))
                        current, current_tokens = [], 0
                    parts.append(" ".join(words[start : start + words_per_part]))
            else:
                current.append(sentence)
                current_tokens += sentence_tokens
        if current:
            parts.append(" ".join(current))

        return [
            _Segment(
                **{
                    **segment.__dict__,
                    "text": part,
                    "complete": False,
                    "split_reason": "size_limit",
                }
            )
            for part in parts
            if part
        ]

    def _segments_from_markdown(self, markdown: str) -> List[_Segment]:
        segments: List[_Segment] = []
        heading_stack: List[str] = []
        hierarchy: Dict[str, Optional[str]] = {
            "part": None, "chapter": None, "section": None, "article": None
        }
        page = 1
        source = "native_text"
        confidence: Optional[float] = None
        offset = 0
        in_frontmatter = False
        paragraph: List[tuple[str, int, int]] = []
        table: List[tuple[str, int, int]] = []

        def make_segment(items: List[tuple[str, int, int]], kind: str) -> None:
            if not items:
                return
            text = "\n".join(item[0] for item in items).strip() if kind == "table" else " ".join(item[0] for item in items).strip()
            if not text:
                return
            clause_match = _CLAUSE.match(text)
            point_match = _POINT.match(text)
            segments.append(
                _Segment(
                    text=text,
                    page=page,
                    page_end=page,
                    heading_path=list(heading_stack),
                    kind=kind,
                    part=hierarchy["part"],
                    chapter=hierarchy["chapter"],
                    section=hierarchy["section"],
                    article=hierarchy["article"],
                    clause=f"Khoản {clause_match.group(1)}" if clause_match else None,
                    point=f"Điểm {point_match.group(1).lower()}" if point_match else None,
                    markdown_start_offset=items[0][1],
                    markdown_end_offset=items[-1][2],
                    contains_ocr=source == "ocr",
                    ocr_confidence=confidence,
                )
            )

        def flush() -> None:
            nonlocal paragraph, table
            make_segment(paragraph, "text")
            make_segment(table, "table")
            paragraph, table = [], []

        for line_with_end in markdown.splitlines(keepends=True):
            line_start = offset
            offset += len(line_with_end)
            line = line_with_end.strip()
            if line == "---":
                flush()
                in_frontmatter = not in_frontmatter
                continue
            if in_frontmatter:
                continue
            page_match = _PAGE_MARKER.match(line)
            if page_match:
                flush()
                page = int(page_match.group(1))
                source = page_match.group(2) or "native_text"
                confidence = float(page_match.group(3)) if page_match.group(3) else None
                continue
            heading_match = _HEADING.match(line)
            if heading_match:
                flush()
                level = len(heading_match.group(1))
                title = heading_match.group(2).strip()
                del heading_stack[level - 1 :]
                heading_stack.append(title)
                if _PART.match(title):
                    hierarchy.update(part=title, chapter=None, section=None, article=None)
                elif _CHAPTER.match(title) or _APPENDIX.match(title):
                    hierarchy.update(chapter=title, section=None, article=None)
                elif _SECTION.match(title):
                    hierarchy.update(section=title, article=None)
                elif _ARTICLE.match(title):
                    hierarchy["article"] = title
                continue
            if not line:
                flush()
                continue
            item = (line, line_start, offset)
            if line.startswith("|") and line.endswith("|"):
                if paragraph:
                    make_segment(paragraph, "text")
                    paragraph = []
                table.append(item)
            else:
                if table:
                    make_segment(table, "table")
                    table = []
                paragraph.append(item)
        flush()
        return [part for segment in segments for part in self._split_oversized(segment)]

    @staticmethod
    def _same_semantic_unit(left: _Segment, right: _Segment) -> bool:
        return (
            left.article == right.article
            and left.heading_path == right.heading_path
            and left.kind == right.kind
        )

    def chunk_markdown(
        self,
        markdown: str,
        document_metadata: Optional[Dict[str, Any]] = None,
    ) -> List[DocumentChunk]:
        metadata = enrich_document_metadata(markdown, document_metadata)
        segments = self._segments_from_markdown(markdown)
        if not segments:
            return []

        chunks: List[DocumentChunk] = []
        current: List[_Segment] = []
        current_tokens = 0

        def flush(reason: str, carry_overlap: bool = False) -> None:
            nonlocal current, current_tokens
            if not current:
                return
            content = "\n\n".join(item.text for item in current).strip()
            first = current[0]
            breadcrumb = " > ".join(first.heading_path)
            topics = _extract_topics(f"{breadcrumb} {content}")
            clauses = list(dict.fromkeys(item.clause for item in current if item.clause))
            points = list(dict.fromkeys(item.point for item in current if item.point))
            aliases = [alias for topic in topics for alias in _SEARCH_ALIASES.get(topic, ())]
            context_values = [
                metadata.get("title"), metadata.get("document_number"),
                metadata.get("issued_date"), metadata.get("valid_from"),
                metadata.get("valid_to"), breadcrumb, " ".join(aliases), content,
            ]
            search_text = "\n".join(str(value) for value in context_values if value not in (None, ""))
            chunk = DocumentChunk(
                chunk_index=len(chunks),
                page=min(item.page for item in current),
                page_end=max(item.page_end for item in current),
                tokens=estimate_tokens(content),
                content=content,
                search_text=search_text,
                heading_path=list(first.heading_path),
                kind=first.kind if all(item.kind == first.kind for item in current) else "text",
                part=first.part,
                chapter=first.chapter,
                section=first.section,
                article=first.article,
                clause=clauses[0] if len(clauses) == 1 else None,
                point=points[0] if len(points) == 1 else None,
                semantic_topics=topics,
                keywords=_extract_keywords(f"{breadcrumb} {content}"),
                entities=_extract_entities(content),
                markdown_start_offset=min(
                    item.markdown_start_offset for item in current if item.markdown_start_offset is not None
                ),
                markdown_end_offset=max(
                    item.markdown_end_offset for item in current if item.markdown_end_offset is not None
                ),
                is_complete_semantic_unit=all(item.complete for item in current) and reason != "size_limit",
                split_reason=reason,
                contains_ocr=any(item.contains_ocr for item in current),
                ocr_confidence_min=min(
                    (item.ocr_confidence for item in current if item.ocr_confidence is not None),
                    default=None,
                ),
                metadata={
                    "chunking_version": CHUNKING_VERSION,
                    "aliases": aliases,
                    "source_blocks": len(current),
                    "clauses": clauses,
                    "points": points,
                },
            )
            chunks.append(chunk)
            previous = current
            current, current_tokens = [], 0
            if carry_overlap and self.overlap_tokens and first.kind == "text":
                words = previous[-1].text.split()
                overlap_words = max(1, int(self.overlap_tokens / 1.3))
                overlap_text = " ".join(words[-overlap_words:])
                if overlap_text:
                    current = [
                        _Segment(
                            **{
                                **previous[-1].__dict__,
                                "text": overlap_text,
                                "complete": False,
                                "split_reason": "overlap",
                            }
                        )
                    ]
                    current_tokens = estimate_tokens(overlap_text)

        for segment in segments:
            segment_tokens = estimate_tokens(segment.text)
            if current and not self._same_semantic_unit(current[0], segment):
                flush("semantic_boundary")
            if current and current_tokens + segment_tokens > self.max_tokens:
                flush("size_limit", carry_overlap=True)
            current.append(segment)
            current_tokens += segment_tokens
            if segment.kind == "table":
                flush("table_boundary")
            elif current_tokens >= self.target_tokens:
                flush("size_limit", carry_overlap=True)
        flush("semantic_boundary")

        for index, chunk in enumerate(chunks):
            chunk.chunk_index = index
            chunk.metadata["previous_chunk_index"] = index - 1 if index > 0 else None
            chunk.metadata["next_chunk_index"] = index + 1 if index + 1 < len(chunks) else None
        logger.info("Created %d deterministic legal semantic chunks", len(chunks))
        return chunks

    def chunk_pdf(
        self,
        parsed_pdf: ParsedPDF,
        document_metadata: Optional[Dict[str, Any]] = None,
    ) -> List[DocumentChunk]:
        artifact = build_legal_markdown(parsed_pdf, document_metadata)
        return self.chunk_markdown(artifact.content, artifact.metadata)

    def chunk_text(self, text: str, page_number: int = 1) -> List[DocumentChunk]:
        page = PDFPage(page_number=page_number, text=text, char_count=len(text))
        return self.chunk_pdf(
            ParsedPDF(
                pages=[page],
                total_pages=1,
                total_chars=len(text),
                parser_used="direct_text",
            )
        )
