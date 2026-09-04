"""Retrieval and semantic caching package for ST-Care Core AI."""

from core_ai.retrieval.bm25 import (
    BM25Okapi,
    BM25Retriever,
    RankedChunk,
    tokenize_vietnamese,
)
from core_ai.retrieval.context_builder import (
    ContextBuilder,
    FormattedContext,
)
from core_ai.retrieval.embeddings import (
    EmbeddingService,
    GeminiEmbedding2Embeddings,
)
from core_ai.retrieval.reranker import (
    EvidenceEvaluationResult,
    LocalReranker,
)
from core_ai.retrieval.rrf import (
    reciprocal_rank_fusion,
)
from core_ai.retrieval.semantic_cache import (
    CachedAnswer,
    SemanticCache,
    compute_query_hash,
)
from core_ai.retrieval.vector_search import (
    ParallelHybridRetriever,
    VectorRetriever,
)

__all__ = [
    "EmbeddingService",
    "GeminiEmbedding2Embeddings",
    "RankedChunk",
    "BM25Okapi",
    "BM25Retriever",
    "tokenize_vietnamese",
    "VectorRetriever",
    "ParallelHybridRetriever",
    "reciprocal_rank_fusion",
    "LocalReranker",
    "EvidenceEvaluationResult",
    "ContextBuilder",
    "FormattedContext",
    "SemanticCache",
    "CachedAnswer",
    "compute_query_hash",
]
