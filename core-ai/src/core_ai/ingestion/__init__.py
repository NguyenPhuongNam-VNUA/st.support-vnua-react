"""Ingestion package for ST-Care Core AI microservice.

Provides offline and background document processing:
- IngestionWorker: Main pipeline coordinator (download -> OCR/parse -> Markdown -> chunk -> embed).
- PDFParser: Native extraction with deterministic Tesseract OCR fallback.
- DocumentChunker: Legal-structure-aware deterministic semantic chunker.
- DocumentChunk: Data structure representing an embedded text chunk.
- PDFPage, ParsedPDF: Data structures representing extracted PDF pages.
"""

from core_ai.ingestion.chunker import (
    DocumentChunk,
    DocumentChunker,
    MarkdownArtifact,
    build_legal_markdown,
    estimate_tokens,
)
from core_ai.ingestion.pdf_parser import (
    ParsedPDF,
    PDFBlock,
    PDFPage,
    PDFParser,
)
from core_ai.ingestion.worker import IngestionWorker

__all__ = [
    "IngestionWorker",
    "PDFParser",
    "PDFPage",
    "ParsedPDF",
    "PDFBlock",
    "DocumentChunker",
    "DocumentChunk",
    "MarkdownArtifact",
    "build_legal_markdown",
    "estimate_tokens",
]
