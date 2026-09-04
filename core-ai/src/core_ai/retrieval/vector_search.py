"""Dense vector retrieval and parallel hybrid search coordinator for ST-Care Core AI.

Executes Gemini Embedding 2 pgvector cosine distance search against PostgreSQL and orchestrates
concurrent execution of dense vector search and sparse BM25 search.
"""

import asyncio
import logging
from typing import Any, List, Optional, Tuple

from core_ai.data.repositories.document_repo import DocumentRepository
from core_ai.data.repositories.question_repo import QuestionRecord, QuestionRepository
from core_ai.retrieval.bm25 import BM25Retriever, RankedChunk
from core_ai.retrieval.embeddings import EmbeddingService

logger = logging.getLogger("core_ai.retrieval.vector_search")


class VectorRetriever:
    """Dense vector search retriever using Gemini Embedding 2 and pgvector."""

    def __init__(
        self,
        embedding_service: EmbeddingService,
        document_repo: DocumentRepository,
        question_repo: Optional[QuestionRepository] = None,
    ) -> None:
        self.embedding_service = embedding_service
        self.document_repo = document_repo
        self.question_repo = question_repo

    async def retrieve(
        self,
        query: str,
        query_embedding: Optional[List[float]] = None,
        top_k: int = 10,
        tenant_id: str = "vnua",
        min_similarity: float = 0.0,
        include_dense: bool = True,
    ) -> List[RankedChunk]:
        """Generate query embedding (if not provided) and query document_chunks by vector similarity.

        Returns list of RankedChunk ordered by cosine similarity with 1-based ranks.
        """
        emb = query_embedding
        if emb is None:
            emb = await self.embedding_service.embed_query(query)

        chunks = await self.document_repo.search_chunks_by_vector(
            query_embedding=emb,
            top_k=top_k,
            tenant_id=tenant_id,
            min_similarity=min_similarity,
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
                    similarity=chunk.similarity,
                    rank=rank_pos,
                    retrieval_source="dense",
                )
            )
        return ranked

    async def search_faq(
        self,
        query: str,
        query_embedding: Optional[List[float]] = None,
        top_k: int = 3,
        min_similarity: float = 0.75,
        tenant_id: str = "vnua",
    ) -> List[QuestionRecord]:
        """Search verified questions (FAQ bank) for high-confidence canned answers."""
        if self.question_repo is None:
            return []

        emb = query_embedding
        if emb is None:
            emb = await self.embedding_service.embed_query(query)

        return await self.question_repo.search_questions_by_vector(
            query_embedding=emb,
            top_k=top_k,
            min_similarity=min_similarity,
            tenant_id=tenant_id,
        )


class ParallelHybridRetriever:
    """Orchestrates parallel execution of dense vector search and sparse BM25 search."""

    def __init__(
        self,
        vector_retriever: VectorRetriever,
        bm25_retriever: BM25Retriever,
    ) -> None:
        self.vector_retriever = vector_retriever
        self.bm25_retriever = bm25_retriever

    async def retrieve_parallel(
        self,
        query: str,
        query_embedding: Optional[List[float]] = None,
        top_k: int = 15,
        tenant_id: str = "vnua",
        min_similarity: float = 0.0,
        include_dense: bool = True,
    ) -> Tuple[List[RankedChunk], List[RankedChunk]]:
        """Run dense vector search and sparse BM25 search concurrently via asyncio.gather.

        Returns:
            Tuple of (dense_results, sparse_results)
        """
        logger.debug(
            "Executing parallel hybrid retrieval (query_chars=%d, top_k=%d)",
            len(query),
            top_k,
        )

        # Launch dense and sparse tasks simultaneously
        dense_task = (
            asyncio.create_task(
                self.vector_retriever.retrieve(
                    query=query,
                    query_embedding=query_embedding,
                    top_k=top_k,
                    tenant_id=tenant_id,
                    min_similarity=min_similarity,
                )
            )
            if include_dense
            else None
        )
        sparse_task = asyncio.create_task(
            self.bm25_retriever.retrieve(
                query=query,
                top_k=top_k,
                tenant_id=tenant_id,
            )
        )

        if dense_task is None:
            dense_outcome: Any = []
            sparse_outcome: Any = await asyncio.gather(
                sparse_task,
                return_exceptions=True,
            )
            sparse_outcome = sparse_outcome[0]
        else:
            dense_outcome, sparse_outcome = await asyncio.gather(
                dense_task,
                sparse_task,
                return_exceptions=True,
            )

        dense_error = isinstance(dense_outcome, BaseException)
        sparse_error = isinstance(sparse_outcome, BaseException)
        if dense_error:
            logger.warning("Dense retrieval degraded: %s", type(dense_outcome).__name__)
        if sparse_error:
            logger.warning("Sparse retrieval degraded: %s", type(sparse_outcome).__name__)
        if dense_error and sparse_error:
            raise RuntimeError("Both dense and sparse retrieval backends failed")

        dense_results = [] if dense_error else dense_outcome
        sparse_results = [] if sparse_error else sparse_outcome

        logger.debug(
            "Parallel retrieval completed: %d dense candidates, %d sparse candidates",
            len(dense_results),
            len(sparse_results),
        )
        return dense_results, sparse_results

    async def retrieve(
        self,
        query: str,
        limit: int = 5,
        **kwargs: Any,
    ) -> Any:
        """Compatibility alias for retrieve_parallel."""
        top_k = kwargs.pop("top_k", limit)
        return await self.retrieve_parallel(query, top_k=top_k, **kwargs)

    async def search(
        self,
        query: str,
        limit: int = 5,
        **kwargs: Any,
    ) -> Any:
        """Compatibility alias for retrieve_parallel."""
        top_k = kwargs.pop("top_k", limit)
        return await self.retrieve_parallel(query, top_k=top_k, **kwargs)


_global_hybrid_retriever: Optional[ParallelHybridRetriever] = None


def get_hybrid_retriever() -> ParallelHybridRetriever:
    """Factory singleton for ParallelHybridRetriever.

    Returns the globally cached ParallelHybridRetriever instance or creates one,
    registering it with the component container.
    """
    global _global_hybrid_retriever
    if _global_hybrid_retriever is not None:
        return _global_hybrid_retriever

    from core_ai.dependencies import (
        get_component,
        get_document_repository,
        get_embedding_service,
        register_component,
    )

    existing = get_component("hybrid_retriever") or get_component("retrieval_service")
    if existing is not None and isinstance(existing, ParallelHybridRetriever):
        _global_hybrid_retriever = existing
        return _global_hybrid_retriever

    doc_repo = get_document_repository()
    emb_service = get_embedding_service()
    from core_ai.retrieval.bm25 import BM25Retriever

    v_retriever = VectorRetriever(embedding_service=emb_service, document_repo=doc_repo)
    b_retriever = BM25Retriever(document_repo=doc_repo)
    _global_hybrid_retriever = ParallelHybridRetriever(
        vector_retriever=v_retriever,
        bm25_retriever=b_retriever,
    )
    register_component("hybrid_retriever", _global_hybrid_retriever)
    register_component("retrieval_service", _global_hybrid_retriever)
    return _global_hybrid_retriever


__all__ = [
    "VectorRetriever",
    "ParallelHybridRetriever",
    "get_hybrid_retriever",
]
