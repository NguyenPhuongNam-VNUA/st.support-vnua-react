"""Question (FAQ Knowledge Bank) repository for PostgreSQL.

Interacts with public.questions and applies an explicit tenant predicate to every query.
"""

import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field

from core_ai.config import Settings, get_settings
from core_ai.contracts.errors import RetrievalError
from core_ai.data.postgres import get_db_connection

logger = logging.getLogger("core_ai.data.repositories.question_repo")


class QuestionRecord(BaseModel):
    """Corresponds to public.questions record."""
    id: int
    question: str
    answer: Optional[str] = None
    topic: Optional[str] = None
    status: Optional[str] = "approved"
    duplicate_score: Optional[float] = 0.0
    duplicate_of_question_id: Optional[int] = None
    source_document_id: Optional[int] = None
    similarity: Optional[float] = Field(default=None, description="Cosine similarity (0.0 - 1.0)")
    created_at: Optional[datetime] = None
    source_article: Optional[str] = None
    source_clause: Optional[str] = None
    verified_at: Optional[datetime] = None
    valid_from: Optional[datetime] = None
    valid_to: Optional[datetime] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)


class QuestionRepository:
    """Repository handling SQL queries for questions table."""

    def __init__(self, settings: Optional[Settings] = None) -> None:
        self.settings = settings or get_settings()

    def is_tenant_allowed(self, tenant_id: str) -> bool:
        """Validate single-tenant application isolation."""
        allowed = self.settings.allowed_tenants
        if isinstance(allowed, str):
            allowed = [t.strip() for t in allowed.split(",")]
        return tenant_id in allowed or tenant_id == self.settings.default_tenant

    async def get_questions_for_embedding(
        self,
        question_ids: List[int],
        tenant_id: str = "vnua",
    ) -> List[QuestionRecord]:
        """Fetch tenant-scoped questions that have enough content to be embedded."""
        if not question_ids or not self.is_tenant_allowed(tenant_id):
            return []

        query = """
            SELECT id, question, answer, topic, status, duplicate_score,
                   duplicate_of_question_id, source_document_id, created_at
            FROM public.questions
            WHERE id = ANY($1::bigint[])
              AND tenant_id = $2
              AND answer IS NOT NULL
              AND btrim(answer) <> '';
        """
        async with get_db_connection(tenant_id) as conn:
            rows = await conn.fetch(query, question_ids, tenant_id)
            return [QuestionRecord(**dict(row)) for row in rows]

    async def save_embedding_and_approve(
        self,
        question_id: int,
        expected_question: str,
        embedding: List[float],
        tenant_id: str = "vnua",
    ) -> bool:
        """Persist an embedding only if the question text has not changed meanwhile."""
        if not embedding or not self.is_tenant_allowed(tenant_id):
            return False

        vector_str = f"[{','.join(str(value) for value in embedding)}]"
        query = """
            UPDATE public.questions
            SET embedding = $1::vector,
                embedding_model = $2,
                embedding_dimension = $3,
                verified_at = now(),
                status = 'approved',
                updated_at = now()
            WHERE id = $4
              AND tenant_id = $5
              AND question = $6
              AND answer IS NOT NULL
              AND btrim(answer) <> ''
            RETURNING id;
        """
        async with get_db_connection(tenant_id) as conn:
            row = await conn.fetchrow(
                query,
                vector_str,
                self.settings.embedding_model,
                self.settings.embedding_dimension,
                question_id,
                tenant_id,
                expected_question,
            )
            return row is not None

    async def search_questions_by_vector(
        self,
        query_embedding: List[float],
        top_k: int = 5,
        min_similarity: float = 0.6,
        tenant_id: str = "vnua",
    ) -> List[QuestionRecord]:
        """Perform dense vector similarity search over approved FAQ questions.

        Returns top_k questions with similarity >= min_similarity.
        """
        if not self.is_tenant_allowed(tenant_id):
            logger.warning("Tenant '%s' rejected by tenant isolation policy.", tenant_id)
            return []

        if not query_embedding:
            return []

        vector_str = f"[{','.join(str(round(x, 6)) for x in query_embedding)}]"

        query = """
            SELECT
                id,
                question,
                answer,
                topic,
                status,
                duplicate_score,
                duplicate_of_question_id,
                source_document_id,
                source_article,
                source_clause,
                verified_at,
                valid_from,
                valid_to,
                metadata,
                1.0 - (embedding <=> $1::vector) AS similarity,
                created_at
            FROM public.questions
            WHERE status = 'approved'
              AND tenant_id = $3
              AND answer IS NOT NULL
              AND btrim(answer) <> ''
              AND embedding IS NOT NULL
              AND embedding_model = $4
              AND embedding_dimension = $5
            ORDER BY embedding <=> $1::vector ASC
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
                results: List[QuestionRecord] = []
                for row in rows:
                    sim = float(row["similarity"]) if row["similarity"] is not None else 0.0
                    sim = max(0.0, min(1.0, sim))
                    if sim >= min_similarity:
                        results.append(
                            QuestionRecord(
                                id=row["id"],
                                question=row["question"],
                                answer=row["answer"],
                                topic=row["topic"],
                                status=row["status"],
                                duplicate_score=float(row["duplicate_score"] or 0.0),
                                duplicate_of_question_id=row["duplicate_of_question_id"],
                                source_document_id=row["source_document_id"],
                                source_article=row["source_article"],
                                source_clause=row["source_clause"],
                                verified_at=row["verified_at"],
                                valid_from=row["valid_from"],
                                valid_to=row["valid_to"],
                                metadata=dict(row["metadata"] or {}),
                                similarity=sim,
                                created_at=row["created_at"],
                            )
                        )
                return results
        except Exception as exc:
            logger.error("Error executing questions vector search: %s", exc, exc_info=True)
            raise RetrievalError(message="Không thể truy vấn kho câu hỏi tương tự") from exc

    async def search_questions_by_text(
        self,
        query_text: str,
        top_k: int = 5,
        tenant_id: str = "vnua",
    ) -> List[QuestionRecord]:
        """Perform text search over approved questions using ILIKE / text search."""
        if not self.is_tenant_allowed(tenant_id):
            return []

        cleaned = query_text.strip()
        if not cleaned:
            return []

        query = """
            SELECT
                id,
                question,
                answer,
                topic,
                status,
                duplicate_score,
                duplicate_of_question_id,
                source_document_id,
                0.8 AS similarity,
                created_at
            FROM public.questions
            WHERE status = 'approved'
              AND tenant_id = $3
              AND question ILIKE $1
            LIMIT $2;
        """

        try:
            pattern = f"%{cleaned}%"
            async with get_db_connection(tenant_id) as conn:
                rows = await conn.fetch(query, pattern, top_k, tenant_id)
                return [
                    QuestionRecord(
                        id=row["id"],
                        question=row["question"],
                        answer=row["answer"],
                        topic=row["topic"],
                        status=row["status"],
                        duplicate_score=float(row["duplicate_score"] or 0.0),
                        duplicate_of_question_id=row["duplicate_of_question_id"],
                        source_document_id=row["source_document_id"],
                        similarity=float(row["similarity"]),
                        created_at=row["created_at"],
                    )
                    for row in rows
                ]
        except Exception as exc:
            logger.error("Error executing questions text search: %s", exc, exc_info=True)
            raise RetrievalError(message="Không thể tìm kiếm trong kho câu hỏi") from exc

    async def get_question_by_id(
        self, question_id: int, tenant_id: str = "vnua"
    ) -> Optional[QuestionRecord]:
        """Fetch a question by ID."""
        if not self.is_tenant_allowed(tenant_id):
            return None

        query = """
            SELECT id, question, answer, topic, status, duplicate_score,
                   duplicate_of_question_id, source_document_id, created_at
            FROM public.questions
            WHERE id = $1 AND tenant_id = $2;
        """
        async with get_db_connection(tenant_id) as conn:
            row = await conn.fetchrow(query, question_id, tenant_id)
            if row is None:
                return None
            return QuestionRecord(
                id=row["id"],
                question=row["question"],
                answer=row["answer"],
                topic=row["topic"],
                status=row["status"],
                duplicate_score=float(row["duplicate_score"] or 0.0),
                duplicate_of_question_id=row["duplicate_of_question_id"],
                source_document_id=row["source_document_id"],
                created_at=row["created_at"],
            )
