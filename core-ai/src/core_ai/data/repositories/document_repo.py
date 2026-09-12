"""Document and Chunk repository for PostgreSQL.

Interacts with public.documents and public.document_chunks tables and enforces
tenant predicates in every read/write query.
"""

import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field

from core_ai.config import Settings, get_settings
from core_ai.contracts.errors import RetrievalError
from core_ai.data.postgres import get_db_connection

logger = logging.getLogger("core_ai.data.repositories.document_repo")


class DocumentRecord(BaseModel):
    """Corresponds to public.documents record."""
    id: int
    title: str
    description: Optional[str] = None
    version: Optional[str] = "v1.0"
    is_active: bool = True
    validity: Optional[str] = None
    pipeline_stage: Optional[str] = "ready"
    progress: Optional[int] = 100
    file_path: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    document_number: Optional[str] = None
    document_type: Optional[str] = None
    issuer: Optional[str] = None
    issued_date: Optional[Any] = None
    valid_from: Optional[datetime] = None
    valid_to: Optional[datetime] = None
    validity_status: Optional[str] = "unknown"
    markdown_path: Optional[str] = None
    markdown_sha256: Optional[str] = None


class ChunkRecord(BaseModel):
    """Corresponds to public.document_chunks joined with document metadata."""
    id: int
    document_id: int
    chunk_index: int
    page: Optional[int] = None
    tokens: Optional[int] = None
    content: str
    document_title: Optional[str] = None
    similarity: Optional[float] = Field(default=None, description="Cosine similarity score (0.0 - 1.0)")
    fts_score: Optional[float] = Field(default=None, description="BM25/FTS rank score")
    created_at: Optional[datetime] = None
    page_end: Optional[int] = None
    source_type: str = "document"
    source_metadata: Dict[str, Any] = Field(default_factory=dict)


class ChunkCreate(BaseModel):
    """DTO for creating or updating a chunk in document_chunks."""
    document_id: int
    chunk_index: int
    page: Optional[int] = None
    tokens: Optional[int] = None
    content: str
    embedding: Optional[List[float]] = None


class DocumentRepository:
    """Repository handling SQL queries for documents and document_chunks."""

    def __init__(self, settings: Optional[Settings] = None) -> None:
        self.settings = settings or get_settings()

    def is_tenant_allowed(self, tenant_id: str) -> bool:
        """Validate single-tenant application isolation."""
        allowed = self.settings.allowed_tenants
        if isinstance(allowed, str):
            allowed = [t.strip() for t in allowed.split(",")]
        return tenant_id in allowed or tenant_id == self.settings.default_tenant

    @staticmethod
    def _chunk_from_row(row: Any, *, similarity: Any = None, fts_score: Any = None) -> ChunkRecord:
        get = row.get
        source_metadata = {
            "document_number": get("document_number"),
            "version": get("version"),
            "document_type": get("document_type"),
            "issuer": get("issuer"),
            "issued_date": get("issued_date"),
            "effective_from": get("valid_from"),
            "effective_to": get("valid_to"),
            "validity_status": get("validity_status") or "unknown",
            "source_trust": float(get("source_trust") or 0.8),
            "page_start": get("page_start") or get("page"),
            "page_end": get("page_end") or get("page"),
            "part": get("part"),
            "chapter": get("chapter"),
            "section": get("section"),
            "article": get("article"),
            "clause": get("clause"),
            "point": get("point"),
            "semantic_topics": get("semantic_topics") or [],
            "keywords": get("keywords") or [],
            "contains_ocr": bool(get("contains_ocr") or False),
            "ocr_confidence_min": get("ocr_confidence_min"),
            "markdown_start_offset": get("markdown_start_offset"),
            "markdown_end_offset": get("markdown_end_offset"),
        }
        return ChunkRecord(
            id=row["id"],
            document_id=row["document_id"],
            chunk_index=row["chunk_index"],
            page=get("page_start") or get("page"),
            page_end=get("page_end") or get("page"),
            tokens=get("tokens"),
            content=row["content"],
            document_title=get("document_title"),
            similarity=float(similarity) if similarity is not None else None,
            fts_score=float(fts_score) if fts_score is not None else None,
            created_at=get("created_at"),
            source_metadata=source_metadata,
        )

    async def search_chunks_by_vector(
        self,
        query_embedding: List[float],
        top_k: int = 10,
        tenant_id: str = "vnua",
        min_similarity: float = 0.0,
    ) -> List[ChunkRecord]:
        """Perform dense vector similarity search using pgvector cosine distance (<=>).

        Computes similarity as: 1.0 - (embedding <=> query_vector)
        Filters exclusively on active and ready documents.
        """
        if not self.is_tenant_allowed(tenant_id):
            logger.warning("Tenant '%s' rejected by tenant isolation policy.", tenant_id)
            return []

        if not query_embedding:
            return []

        # Format vector as string '[0.123,0.456,...]' compatible with $1::vector cast
        vector_str = f"[{','.join(str(round(x, 6)) for x in query_embedding)}]"

        query = """
            SELECT
                dc.id,
                dc.document_id,
                dc.chunk_index,
                dc.page,
                dc.page_start,
                dc.page_end,
                dc.tokens,
                dc.content,
                d.title AS document_title,
                d.document_number,
                d.version,
                d.document_type,
                d.issuer,
                d.issued_date,
                d.valid_from,
                d.valid_to,
                d.validity_status,
                d.source_trust,
                dc.part,
                dc.chapter,
                dc.section,
                dc.article,
                dc.clause,
                dc.point,
                dc.semantic_topics,
                dc.keywords,
                dc.contains_ocr,
                dc.ocr_confidence_min,
                dc.markdown_start_offset,
                dc.markdown_end_offset,
                1.0 - (dc.embedding <=> $1::vector) AS similarity,
                dc.created_at
            FROM public.document_chunks dc
            JOIN public.documents d ON d.id = dc.document_id AND d.tenant_id = dc.tenant_id
            WHERE d.is_active = true
              AND d.pipeline_stage = 'ready'
              AND d.tenant_id = $3
              AND dc.tenant_id = $3
              AND dc.embedding IS NOT NULL
              AND dc.embedding_model = $4
              AND dc.embedding_dimension = $5
            ORDER BY dc.embedding <=> $1::vector ASC
            LIMIT $2;
        """

        try:
            async with get_db_connection(tenant_id) as conn:
                rows = await conn.fetch(
                    query,
                    vector_str,
                    top_k,
                    tenant_id,
                    self.settings.embedding_model,
                    self.settings.embedding_dimension,
                )
                results: List[ChunkRecord] = []
                for row in rows:
                    sim = float(row["similarity"]) if row["similarity"] is not None else 0.0
                    # Clamp similarity to [0.0, 1.0]
                    sim = max(0.0, min(1.0, sim))
                    if sim >= min_similarity:
                        results.append(self._chunk_from_row(row, similarity=sim))
                return results
        except Exception as exc:
            logger.error("Error executing vector search: %s", exc, exc_info=True)
            raise RetrievalError(message="Không thể truy vấn kho vector tài liệu") from exc

    async def search_chunks_by_bm25(
        self,
        query_text: Optional[str] = None,
        top_k: int = 10,
        tenant_id: str = "vnua",
        query_terms: Optional[List[str]] = None,
    ) -> List[ChunkRecord]:
        """Perform sparse BM25 / Full-Text Search on chunk content.

        Uses PostgreSQL's to_tsvector('simple', content) and ts_rank_cd.
        Supports query_terms as a list of tokens or query_text as a full string.
        """
        if not self.is_tenant_allowed(tenant_id):
            logger.warning("Tenant '%s' rejected by tenant isolation policy.", tenant_id)
            return []

        if query_terms is not None:
            query_text = " ".join(query_terms)

        if not query_text:
            return []

        cleaned_text = query_text.strip()
        if not cleaned_text:
            return []

        query = """
            SELECT
                dc.id,
                dc.document_id,
                dc.chunk_index,
                dc.page,
                dc.page_start,
                dc.page_end,
                dc.tokens,
                dc.content,
                d.title AS document_title,
                d.document_number,
                d.version,
                d.document_type,
                d.issuer,
                d.issued_date,
                d.valid_from,
                d.valid_to,
                d.validity_status,
                d.source_trust,
                dc.part,
                dc.chapter,
                dc.section,
                dc.article,
                dc.clause,
                dc.point,
                dc.semantic_topics,
                dc.keywords,
                dc.contains_ocr,
                dc.ocr_confidence_min,
                dc.markdown_start_offset,
                dc.markdown_end_offset,
                ts_rank_cd(
                    to_tsvector('simple', coalesce(dc.search_text, dc.content)),
                    plainto_tsquery('simple', $1)
                ) AS fts_score,
                dc.created_at
            FROM public.document_chunks dc
            JOIN public.documents d ON d.id = dc.document_id AND d.tenant_id = dc.tenant_id
            WHERE d.is_active = true
              AND d.pipeline_stage = 'ready'
              AND d.tenant_id = $3
              AND dc.tenant_id = $3
              AND to_tsvector('simple', coalesce(dc.search_text, dc.content))
                  @@ plainto_tsquery('simple', $1)
            ORDER BY fts_score DESC
            LIMIT $2;
        """

        try:
            async with get_db_connection(tenant_id) as conn:
                rows = await conn.fetch(query, cleaned_text, top_k, tenant_id)
                if not rows:
                    # Fallback to ILIKE substring search if tsquery matched 0 tokens
                    fallback_query = """
                        SELECT
                            dc.id,
                            dc.document_id,
                            dc.chunk_index,
                            dc.page,
                            dc.page_start,
                            dc.page_end,
                            dc.tokens,
                            dc.content,
                            d.title AS document_title,
                            d.document_number,
                            d.version,
                            d.document_type,
                            d.issuer,
                            d.issued_date,
                            d.valid_from,
                            d.valid_to,
                            d.validity_status,
                            d.source_trust,
                            dc.part,
                            dc.chapter,
                            dc.section,
                            dc.article,
                            dc.clause,
                            dc.point,
                            dc.semantic_topics,
                            dc.keywords,
                            dc.contains_ocr,
                            dc.ocr_confidence_min,
                            dc.markdown_start_offset,
                            dc.markdown_end_offset,
                            0.5 AS fts_score,
                            dc.created_at
                        FROM public.document_chunks dc
                        JOIN public.documents d ON d.id = dc.document_id AND d.tenant_id = dc.tenant_id
                        WHERE d.is_active = true
                          AND d.pipeline_stage = 'ready'
                          AND d.tenant_id = $3
                          AND dc.tenant_id = $3
                          AND (
                            coalesce(dc.search_text, dc.content) ILIKE $1
                            OR d.title ILIKE $1
                            OR coalesce(d.document_number, '') ILIKE $1
                          )
                        LIMIT $2;
                    """
                    pattern = f"%{cleaned_text[:50]}%"
                    rows = await conn.fetch(fallback_query, pattern, top_k, tenant_id)

                results: List[ChunkRecord] = []
                for row in rows:
                    score = float(row["fts_score"]) if row["fts_score"] is not None else 0.0
                    results.append(self._chunk_from_row(row, fts_score=score))
                return results
        except Exception as exc:
            logger.error("Error executing BM25/FTS search: %s", exc, exc_info=True)
            raise RetrievalError(message="Không thể tìm kiếm toàn văn trong kho tài liệu") from exc

    async def get_document_by_id(
        self, document_id: int, tenant_id: str = "vnua"
    ) -> Optional[DocumentRecord]:
        """Fetch a single document by its primary key ID."""
        if not self.is_tenant_allowed(tenant_id):
            return None

        query = """
            SELECT id, title, description, version, is_active, validity,
                   pipeline_stage, progress, file_path, created_at, updated_at
            FROM public.documents
            WHERE id = $1 AND tenant_id = $2;
        """
        async with get_db_connection(tenant_id) as conn:
            row = await conn.fetchrow(query, document_id, tenant_id)
            if row is None:
                return None
            return DocumentRecord(
                id=row["id"],
                title=row["title"],
                description=row["description"],
                version=row["version"],
                is_active=row["is_active"],
                validity=row["validity"],
                pipeline_stage=row["pipeline_stage"],
                progress=row["progress"],
                file_path=row["file_path"],
                created_at=row["created_at"],
                updated_at=row["updated_at"],
            )

    async def get_chunks_by_document_id(
        self, document_id: int, tenant_id: str = "vnua"
    ) -> List[ChunkRecord]:
        """Fetch all chunks belonging to a document ordered by chunk_index."""
        if not self.is_tenant_allowed(tenant_id):
            return []

        query = """
            SELECT dc.id, dc.document_id, dc.chunk_index, dc.page, dc.tokens,
                   dc.content, d.title AS document_title, dc.created_at
            FROM public.document_chunks dc
            JOIN public.documents d ON d.id = dc.document_id
            WHERE dc.document_id = $1 AND d.tenant_id = $2 AND dc.tenant_id = $2
            ORDER BY dc.chunk_index ASC;
        """
        async with get_db_connection(tenant_id) as conn:
            rows = await conn.fetch(query, document_id, tenant_id)
            return [
                ChunkRecord(
                    id=row["id"],
                    document_id=row["document_id"],
                    chunk_index=row["chunk_index"],
                    page=row["page"],
                    tokens=row["tokens"],
                    content=row["content"],
                    document_title=row["document_title"],
                    created_at=row["created_at"],
                )
                for row in rows
            ]

    async def insert_chunks(self, chunks: List[ChunkCreate], tenant_id: str = "vnua") -> int:
        """Bulk insert/upsert document chunks with embedding vectors."""
        if not self.is_tenant_allowed(tenant_id) or not chunks:
            return 0

        upsert_query = """
            INSERT INTO public.document_chunks
                (document_id, tenant_id, chunk_index, page, tokens, content, embedding,
                 embedding_model, embedding_dimension)
            SELECT $1, $9, $2, $3, $4, $5, $6::vector, $7, $8
            WHERE EXISTS (
                SELECT 1 FROM public.documents WHERE id = $1 AND tenant_id = $9
            )
            ON CONFLICT (document_id, chunk_index) DO UPDATE
            SET page = EXCLUDED.page,
                tenant_id = EXCLUDED.tenant_id,
                tokens = EXCLUDED.tokens,
                content = EXCLUDED.content,
                embedding = EXCLUDED.embedding,
                embedding_model = EXCLUDED.embedding_model,
                embedding_dimension = EXCLUDED.embedding_dimension;
        """

        count = 0
        async with get_db_connection(tenant_id) as conn:
            for ch in chunks:
                vec_str = (
                    f"[{','.join(str(round(x, 6)) for x in ch.embedding)}]"
                    if ch.embedding
                    else None
                )
                result = await conn.execute(
                    upsert_query,
                    ch.document_id,
                    ch.chunk_index,
                    ch.page,
                    ch.tokens,
                    ch.content,
                    vec_str,
                    self.settings.embedding_model,
                    self.settings.embedding_dimension,
                    tenant_id,
                )
                if result.endswith(" 1"):
                    count += 1
        return count

    async def update_document_stage(
        self,
        document_id: int,
        stage: str,
        progress: int,
        tenant_id: str = "vnua",
    ) -> bool:
        """Update pipeline stage and progress for a document."""
        if not self.is_tenant_allowed(tenant_id):
            return False

        query = """
            UPDATE public.documents
            SET pipeline_stage = $2,
                progress = $3,
                updated_at = now()
            WHERE id = $1 AND tenant_id = $4;
        """
        async with get_db_connection(tenant_id) as conn:
            res = await conn.execute(query, document_id, stage, progress, tenant_id)
            return "UPDATE 1" in res
