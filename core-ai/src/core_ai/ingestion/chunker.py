"""Document chunker using sliding window with token overlap for ST-Care.

Specifically designed for Vietnamese academic documents:
- Target window: 500 to 800 tokens (default target: 650 tokens)
- Overlap: 100 tokens
- Preserves paragraph and sentence boundaries
- Accurately tracks original PDF page numbers for citation linking
"""

from dataclasses import dataclass
import logging
import re
from typing import List, Optional, Tuple

from core_ai.ingestion.pdf_parser import ParsedPDF, PDFPage

logger = logging.getLogger("core_ai.ingestion.chunker")


@dataclass
class DocumentChunk:
    """Represents a discrete text chunk ready for vector embedding and database insertion."""

    chunk_index: int  # 0-based sequential index
    page: int  # 1-based source page in PDF
    tokens: int  # Estimated token count
    content: str  # Chunk text content


def estimate_tokens(text: str) -> int:
    """Estimates token count for Vietnamese/multilingual text.

    Vietnamese words average ~1.3 subword tokens in standard BPE/SentencePiece models
    (such as XLM-RoBERTa / BGE-M3).
    """
    if not text or not text.strip():
        return 0
    words = text.split()
    word_count = len(words)
    # Estimate ~1.3 tokens per word, with a floor based on character length (~4 chars/token)
    token_est_from_words = int(word_count * 1.3)
    token_est_from_chars = int(len(text) / 3.8)
    return max(1, max(token_est_from_words, token_est_from_chars))


class DocumentChunker:
    """Splits structured text into semantic chunks with sliding token overlap."""

    # Sentence boundaries regex: periods, question marks, exclamation marks, or double newlines
    _SENTENCE_BOUNDARY = re.compile(r"(?<=[.!?\n])\s+")

    def __init__(
        self,
        min_tokens: int = 500,
        max_tokens: int = 800,
        target_tokens: int = 650,
        overlap_tokens: int = 100,
    ) -> None:
        self.min_tokens = min_tokens
        self.max_tokens = max_tokens
        self.target_tokens = target_tokens
        self.overlap_tokens = overlap_tokens

    def _split_into_sentences(self, text: str) -> List[str]:
        """Splits a body of text into clean sentence segments."""
        if not text:
            return []
        raw_sentences = self._SENTENCE_BOUNDARY.split(text)
        sentences: List[str] = []
        for s in raw_sentences:
            s_clean = s.strip()
            if s_clean:
                sentences.append(s_clean)
        return sentences

    def chunk_pdf(self, parsed_pdf: ParsedPDF) -> List[DocumentChunk]:
        """Chunks a ParsedPDF document into page-correlated sliding window chunks."""
        # Build list of (sentence_text, page_number)
        annotated_sentences: List[Tuple[str, int]] = []

        for page in parsed_pdf.pages:
            if not page.text.strip():
                continue
            sentences = self._split_into_sentences(page.text)
            for s in sentences:
                annotated_sentences.append((s, page.page_number))

        if not annotated_sentences:
            logger.warning("No text sentences extracted from PDF to chunk.")
            return []

        chunks: List[DocumentChunk] = []
        chunk_index = 0
        i = 0
        total_sentences = len(annotated_sentences)

        while i < total_sentences:
            current_sentences: List[str] = []
            current_tokens = 0
            start_page = annotated_sentences[i][1]
            start_index = i

            # Accumulate sentences until target or max tokens reached
            while i < total_sentences:
                sent_text, sent_page = annotated_sentences[i]
                sent_tokens = estimate_tokens(sent_text)

                # If adding this sentence exceeds max_tokens and we already have enough tokens
                if current_tokens + sent_tokens > self.max_tokens and current_tokens >= self.min_tokens:
                    break

                current_sentences.append(sent_text)
                current_tokens += sent_tokens
                i += 1

                # If we've reached our ideal target tokens, stop at this natural sentence boundary
                if current_tokens >= self.target_tokens:
                    break

            if not current_sentences:
                # Fallback: single sentence was longer than max_tokens, include it anyway
                sent_text, sent_page = annotated_sentences[i]
                current_sentences.append(sent_text)
                current_tokens = estimate_tokens(sent_text)
                i += 1

            chunk_content = " ".join(current_sentences).strip()
            chunks.append(
                DocumentChunk(
                    chunk_index=chunk_index,
                    page=start_page,
                    tokens=current_tokens,
                    content=chunk_content,
                )
            )
            chunk_index += 1

            # If we reached the end of all sentences, exit loop
            if i >= total_sentences:
                break

            # Calculate overlap: slide index backwards by overlap_tokens
            overlap_accum = 0
            rewind_steps = 0
            for j in range(i - 1, start_index, -1):
                overlap_accum += estimate_tokens(annotated_sentences[j][0])
                rewind_steps += 1
                if overlap_accum >= self.overlap_tokens:
                    break

            # Avoid infinite loop: guarantee that i advances forward by at least 1 sentence
            if rewind_steps > 0 and (i - rewind_steps) > start_index:
                i = i - rewind_steps

        logger.info(
            "Chunked document into %d chunks (avg tokens: %d).",
            len(chunks),
            sum(c.tokens for c in chunks) // max(1, len(chunks)),
        )
        return chunks

    def chunk_text(self, text: str, page_number: int = 1) -> List[DocumentChunk]:
        """Convenience method to chunk raw text with a given page number."""
        dummy_pdf = ParsedPDF(
            pages=[PDFPage(page_number=page_number, text=text, char_count=len(text))],
            total_pages=1,
            total_chars=len(text),
            parser_used="direct_text",
        )
        return self.chunk_pdf(dummy_pdf)
