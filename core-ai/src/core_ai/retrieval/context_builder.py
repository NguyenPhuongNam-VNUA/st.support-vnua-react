"""Prompt context and citation builder for ST-Care Core AI.

Formats retrieved and reranked snippets into grounded LLM prompt context blocks
and builds structured Citation objects conforming to contracts.chat.Citation.
"""

import logging
from typing import List, Optional
from pydantic import BaseModel, Field

from core_ai.contracts.chat import Citation
from core_ai.retrieval.bm25 import RankedChunk

logger = logging.getLogger("core_ai.retrieval.context_builder")


class FormattedContext(BaseModel):
    """Encapsulates context text for prompt assembly and structured citations."""
    context_text: str = Field(..., description="Formatted markdown context block for LLM prompt")
    citations: List[Citation] = Field(..., description="List of Citation models matching src_N tags")
    total_characters: int = Field(default=0)
    snippet_count: int = Field(default=0)


class ContextBuilder:
    """Builder for prompt context and Citation models."""

    def __init__(
        self,
        max_total_chars: int = 8000,
        max_snippet_chars: int = 1500,
    ) -> None:
        self.max_total_chars = max_total_chars
        self.max_snippet_chars = max_snippet_chars

    def build_context(
        self,
        snippets: List[RankedChunk],
        prefix_tag: str = "src",
    ) -> FormattedContext:
        """Assemble retrieved snippets into a numbered reference context block.

        Format:
            ---
            Nguồn [src_1]: Quy chế đào tạo (Trang 12)
            Nội dung: <snippet text>
            ---
        """
        if not snippets:
            return FormattedContext(
                context_text="Không tìm thấy tài liệu tham khảo phù hợp trong hệ thống.",
                citations=[],
                total_characters=0,
                snippet_count=0,
            )

        context_blocks: List[str] = []
        citations: List[Citation] = []
        accumulated_chars = 0

        for idx, chunk in enumerate(snippets, start=1):
            citation_id = f"{prefix_tag}_{idx}"

            # Clean and truncate snippet content if needed
            content = chunk.content.strip()
            if len(content) > self.max_snippet_chars:
                content = content[: self.max_snippet_chars] + "..."

            # Format page number info
            page_info = f" (Trang {chunk.page})" if chunk.page is not None else ""
            title = chunk.document_title or "Tài liệu không tiêu đề"

            block = f"[{citation_id}] Tiêu đề: {title}{page_info}\nNội dung: {content}"

            # Check total character ceiling
            if accumulated_chars + len(block) > self.max_total_chars and citations:
                logger.debug(
                    "Context character budget reached (%d chars). Truncating remaining snippets.",
                    accumulated_chars,
                )
                break

            context_blocks.append(block)
            accumulated_chars += len(block)

            score = chunk.rerank_score or chunk.similarity or 0.85
            citations.append(
                Citation(
                    citation_id=citation_id,
                    document_id=chunk.document_id,
                    title=title,
                    page=chunk.page,
                    chunk_index=chunk.chunk_index,
                    snippet=content[:500],  # Keep reasonable preview snippet for citation payload
                    relevance_score=round(float(score), 4),
                )
            )

        full_context_text = "\n\n---\n\n".join(context_blocks)

        return FormattedContext(
            context_text=full_context_text,
            citations=citations,
            total_characters=len(full_context_text),
            snippet_count=len(citations),
        )
