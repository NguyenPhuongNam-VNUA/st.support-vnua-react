"""Local score reranker and evidence confidence evaluator for ST-Care Core AI.

Re-evaluates RRF candidates using lexical query coverage, semantic similarity,
and phrase proximity to select the top 3-5 snippets and determine evidence sufficiency.
"""

import logging
import time
from typing import List, Optional
from pydantic import BaseModel, Field

from core_ai.retrieval.bm25 import RankedChunk, tokenize_vietnamese

logger = logging.getLogger("core_ai.retrieval.reranker")


class EvidenceEvaluationResult(BaseModel):
    """Result of reranking and evidence sufficiency assessment."""
    snippets: List[RankedChunk] = Field(
        default_factory=list,
        description="Top 3-5 filtered and re-scored evidence snippets",
    )
    overall_evidence_score: float = Field(
        default=0.0,
        ge=0.0,
        le=1.0,
        description="Aggregated confidence score of retrieved evidence",
    )
    is_sufficient: bool = Field(
        default=False,
        description="True if evidence is strong enough to answer without clarification/fallback",
    )
    top_score: float = Field(default=0.0, ge=0.0, le=1.0)
    has_high_relevance_source: bool = Field(default=False)
    latency_ms: int = Field(default=0, ge=0)
    strategy: str = Field(default="heuristic", description="Safe reranking strategy identifier")


class LocalReranker:
    """Local multi-signal reranker for selecting the top 3-5 snippets.

    Evaluates:
    1. Lexical token overlap & phrase matching
    2. Vector cosine similarity (if present)
    3. RRF positional rank signal
    4. Document title relevance
    """

    def __init__(
        self,
        min_evidence_score: float = 0.55,
        min_snippet_score: float = 0.30,
        target_top_n: int = 5,
        min_top_n: int = 3,
    ) -> None:
        self.min_evidence_score = min_evidence_score
        self.min_snippet_score = min_snippet_score
        self.target_top_n = target_top_n
        self.min_top_n = min_top_n

    def _score_snippet(self, query: str, query_tokens: List[str], chunk: RankedChunk) -> float:
        """Compute consolidated relevance score in [0.0, 1.0] for a single candidate."""
        content_lower = chunk.content.lower()
        title_lower = chunk.document_title.lower()
        content_tokens = set(tokenize_vietnamese(content_lower))
        title_tokens = set(tokenize_vietnamese(title_lower))

        # 1. Lexical coverage: proportion of query tokens present in chunk or title
        if query_tokens:
            matched_content = sum(1 for t in query_tokens if t in content_tokens)
            matched_title = sum(1 for t in query_tokens if t in title_tokens)
            token_coverage = (matched_content + 1.5 * matched_title) / (len(query_tokens) * 2.5)
            token_coverage = min(1.0, token_coverage)
        else:
            token_coverage = 0.0

        # 2. Phrase match bonus (exact multi-word match)
        clean_query = query.strip().lower()
        phrase_bonus = 0.0
        if len(clean_query) > 5 and clean_query in content_lower:
            phrase_bonus = 0.20
        elif len(clean_query) > 5 and clean_query in title_lower:
            phrase_bonus = 0.25

        # 3. Dense vector similarity signal (normalized [0, 1])
        vector_sim = chunk.similarity if chunk.similarity is not None else 0.5

        # 4. RRF normalized prior
        rrf_prior = chunk.rrf_score if chunk.rrf_score is not None else 0.5

        # Composite score weighting:
        # 40% Vector similarity + 30% Lexical token coverage + 20% RRF prior + 10% Phrase match
        composite = (
            0.40 * vector_sim
            + 0.30 * token_coverage
            + 0.20 * rrf_prior
            + 0.10 * phrase_bonus
        )

        return round(max(0.0, min(1.0, composite)), 4)

    def rerank(
        self,
        query: str,
        candidates: List[RankedChunk],
        target_top_n: Optional[int] = None,
    ) -> EvidenceEvaluationResult:
        """Score, filter, and re-order candidates to select top 3-5 snippets.

        Returns EvidenceEvaluationResult containing top snippets and sufficiency status.
        """
        start_time = time.perf_counter()
        top_n = target_top_n or self.target_top_n

        if not candidates:
            latency_ms = int((time.perf_counter() - start_time) * 1000)
            return EvidenceEvaluationResult(
                snippets=[],
                overall_evidence_score=0.0,
                is_sufficient=False,
                top_score=0.0,
                has_high_relevance_source=False,
                latency_ms=latency_ms,
            )

        query_tokens = tokenize_vietnamese(query)

        # Score each candidate
        scored: List[RankedChunk] = []
        for chunk in candidates:
            score = self._score_snippet(query, query_tokens, chunk)
            chunk.rerank_score = score
            scored.append(chunk)

        # Sort descending by rerank_score
        scored.sort(key=lambda x: (x.rerank_score or 0.0), reverse=True)

        # Filter out snippets with score below min_snippet_score
        filtered = [c for c in scored if (c.rerank_score or 0.0) >= self.min_snippet_score]

        # If filtering is too aggressive and leaves 0, keep at least the best candidate
        if not filtered and scored:
            filtered = [scored[0]]

        # Sice top snippets: minimum min_top_n if available, up to top_n
        top_snippets = filtered[:top_n]

        # Re-assign sequential final rank
        for i, snippet in enumerate(top_snippets, start=1):
            snippet.rank = i

        top_score = top_snippets[0].rerank_score if top_snippets else 0.0
        has_high_rel = bool(top_score and top_score >= 0.70)

        # Calculate overall evidence score: weighted average favoring the highest scored snippet
        if top_snippets:
            weights = [1.0 / (i + 1) for i in range(len(top_snippets))]
            total_weight = sum(weights)
            weighted_sum = sum(
                (s.rerank_score or 0.0) * w for s, w in zip(top_snippets, weights)
            )
            overall_score = round(weighted_sum / total_weight, 4)
        else:
            overall_score = 0.0

        is_sufficient = (
            len(top_snippets) >= 1
            and overall_score >= self.min_evidence_score
            and (top_score or 0.0) >= 0.50
        )

        latency_ms = int((time.perf_counter() - start_time) * 1000)

        logger.debug(
            "Reranker finished in %d ms: %d top snippets selected, overall score: %.3f (sufficient=%s)",
            latency_ms,
            len(top_snippets),
            overall_score,
            is_sufficient,
        )

        return EvidenceEvaluationResult(
            snippets=top_snippets,
            overall_evidence_score=overall_score,
            is_sufficient=is_sufficient,
            top_score=top_score or 0.0,
            has_high_relevance_source=has_high_rel,
            latency_ms=latency_ms,
        )
