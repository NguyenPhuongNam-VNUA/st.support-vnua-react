"""BM25 sparse full-text search implementation for ST-Care Core AI.

Provides Vietnamese text tokenization, database-backed BM25 search via DocumentRepository,
and an in-memory BM25Okapi engine for candidate re-scoring.
"""

import math
import re
from collections import Counter
from typing import List, Optional

from pydantic import BaseModel, Field

from core_ai.data.repositories.document_repo import DocumentRepository

# Regex for tokenizing Vietnamese and alphanumeric tokens
TOKEN_PATTERN = re.compile(r"[\w]+", re.UNICODE)


def tokenize_vietnamese(text: str) -> List[str]:
    """Tokenize Vietnamese text into lowercase alphanumeric tokens."""
    if not text:
        return []
    return [match.group(0).lower() for match in TOKEN_PATTERN.finditer(text)]


class RankedChunk(BaseModel):
    """Normalized retrieval candidate snippet representation used across retrieval stages."""
    chunk_id: int
    document_id: int
    chunk_index: int
    page: Optional[int] = None
    document_title: str = "Tài liệu không tiêu đề"
    content: str
    similarity: Optional[float] = Field(default=None, description="Vector cosine similarity")
    fts_score: Optional[float] = Field(default=None, description="BM25/FTS score")
    rrf_score: Optional[float] = Field(default=None, description="Reciprocal Rank Fusion score")
    rerank_score: Optional[float] = Field(default=None, description="Local reranker score")
    rank: int = Field(default=1, description="1-based ranking position from retrieval method")
    retrieval_source: str = Field(default="sparse", description="'dense', 'sparse', or 'hybrid'")


class BM25Okapi:
    """In-memory BM25Okapi scoring implementation.

    Used for local lexical re-scoring and validation of candidate text chunks.
    Parameters:
        k1: Term frequency saturation parameter (default 1.5)
        b: Document length normalization parameter (default 0.75)
    """

    def __init__(
        self,
        corpus: List[List[str]],
        k1: float = 1.5,
        b: float = 0.75,
    ) -> None:
        self.k1 = k1
        self.b = b
        self.corpus_size = len(corpus)
        self.doc_lengths = [len(doc) for doc in corpus]
        self.avgdl = sum(self.doc_lengths) / self.corpus_size if self.corpus_size > 0 else 1.0

        # Calculate document frequencies
        self.doc_freqs: List[Counter[str]] = []
        df: Counter[str] = Counter()
        for doc in corpus:
            counts: Counter[str] = Counter(doc)
            self.doc_freqs.append(counts)
            for token in counts.keys():
                df[token] += 1

        # Calculate IDF with Robertson-Spärck Jones formula
        self.idf: dict[str, float] = {}
        for token, freq in df.items():
            # Standard BM25 IDF: ln((N - n + 0.5) / (n + 0.5) + 1.0)
            self.idf[token] = math.log(
                (self.corpus_size - freq + 0.5) / (freq + 0.5) + 1.0
            )

    def score(self, query_tokens: List[str], doc_idx: int) -> float:
        """Compute BM25 score for a query against document at doc_idx."""
        if doc_idx < 0 or doc_idx >= self.corpus_size:
            return 0.0

        doc_len = self.doc_lengths[doc_idx]
        frequencies = self.doc_freqs[doc_idx]
        total_score = 0.0

        for token in query_tokens:
            if token not in frequencies:
                continue
            tf = frequencies[token]
            idf = self.idf.get(token, 0.0)
            # BM25 numerator and denominator
            num = tf * (self.k1 + 1.0)
            denom = tf + self.k1 * (1.0 - self.b + self.b * (doc_len / self.avgdl))
            total_score += idf * (num / denom)

        return max(0.0, total_score)


class BM25Retriever:
    """Sparse retrieval coordinator invoking DocumentRepository's FTS."""

    def __init__(self, document_repo: DocumentRepository) -> None:
        self.document_repo = document_repo

    async def retrieve(
        self,
        query: str,
        top_k: int = 10,
        tenant_id: str = "vnua",
    ) -> List[RankedChunk]:
        """Execute sparse full-text search against PostgreSQL.

        Returns list of RankedChunk ordered by FTS score with 1-based ranks.
        """
        chunks = await self.document_repo.search_chunks_by_bm25(
            query_text=query,
            top_k=top_k,
            tenant_id=tenant_id,
        )

        ranked: List[RankedChunk] = []
        for rank_pos, chunk in enumerate(chunks, start=1):
            ranked.append(
                RankedChunk(
                    chunk_id=chunk.id,
                    document_id=chunk.document_id,
                    chunk_index=chunk.chunk_index,
                    page=chunk.page,
                    document_title=chunk.document_title or "Tài liệu không tiêu đề",
                    content=chunk.content,
                    fts_score=chunk.fts_score,
                    rank=rank_pos,
                    retrieval_source="sparse",
                )
            )
        return ranked
