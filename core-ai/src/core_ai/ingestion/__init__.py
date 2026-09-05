"""Ingestion package for ST-Care Core AI microservice.

Provides offline and background document processing:
- IngestionWorker: Main pipeline coordinator (download -> parse -> chunk -> embed -> upsert).
- PDFParser: Multi-engine extractor with pdfplumber and pypdf fallback.
- DocumentChunker: Sliding window chunker with 500-800 tokens and 100 token overlap.
- DocumentChunk: Data structure representing an embedded text chunk.
- PDFPage, ParsedPDF: Data structures representing extracted PDF pages.
"""

from core_ai.ingestion.chunker import (
    DocumentChunk,
    DocumentChunker,
    estimate_tokens,
)
from core_ai.ingestion.pdf_parser import (
    ParsedPDF,
    PDFPage,
    PDFParser,
)
from core_ai.ingestion.worker import IngestionWorker

__all__ = [
    "IngestionWorker",
    "PDFParser",
    "PDFPage",
    "ParsedPDF",
    "DocumentChunker",
    "DocumentChunk",
    "estimate_tokens",
]
