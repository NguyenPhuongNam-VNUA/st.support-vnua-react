"""Offline PDF/OCR -> Markdown -> semantic chunk -> embedding worker."""

import asyncio
import hashlib
import json
import logging
import time
from datetime import date, datetime, timezone
from datetime import time as datetime_time
from typing import Any, Dict, List, Optional, Union
from urllib.parse import urlparse

import httpx

from core_ai.config import Settings, get_settings
from core_ai.data.postgres import get_db_connection, init_db_pool
from core_ai.data.repositories.document_repo import DocumentRepository
from core_ai.ingestion.chunker import (
    CHUNKING_VERSION,
    DocumentChunk,
    DocumentChunker,
    MarkdownArtifact,
    build_legal_markdown,
)
from core_ai.ingestion.pdf_parser import PDFParser
from core_ai.observability.metrics import record_ingestion
from core_ai.retrieval.embeddings import GeminiEmbedding2Embeddings

logger = logging.getLogger("core_ai.ingestion.worker")


class IngestionWorker:
    """Asynchronous background worker executing full RAG document ingestion."""

    def __init__(
        self,
        settings: Optional[Settings] = None,
        pdf_parser: Optional[PDFParser] = None,
        chunker: Optional[DocumentChunker] = None,
        embedding_service: Optional[Any] = None,
        doc_repo: Optional[DocumentRepository] = None,
    ) -> None:
        self.settings = settings or get_settings()
        self.pdf_parser = pdf_parser or PDFParser(
            max_pages=self.settings.ingestion_max_pdf_pages,
            native_text_min_chars=self.settings.ingestion_native_text_min_chars,
            ocr_timeout_seconds=self.settings.ingestion_ocr_timeout_seconds,
        )
        self.chunker = chunker or DocumentChunker(
            min_tokens=self.settings.ingestion_chunk_min_tokens,
            max_tokens=self.settings.ingestion_chunk_max_tokens,
            target_tokens=self.settings.ingestion_chunk_target_tokens,
            overlap_tokens=self.settings.ingestion_chunk_overlap_tokens,
            hard_max_tokens=self.settings.ingestion_chunk_hard_max_tokens,
        )
        self.embedding_service = embedding_service or GeminiEmbedding2Embeddings(
            settings=self.settings
        )
        self.doc_repo = doc_repo or DocumentRepository(settings=self.settings)
        self._knowledge_versions: Dict[int, int] = {}

    async def _ensure_db(self) -> None:
        """Ensures the database connection pool is active."""
        try:
            from core_ai.data.postgres import get_db_pool

            get_db_pool()
        except Exception:
            await init_db_pool(self.settings)

    async def download_file(self, file_url: str) -> bytes:
        """Download a bounded PDF only from explicitly allowed HTTPS hosts."""
        parsed = urlparse(file_url)
        hostname = (parsed.hostname or "").lower()
        allowed_hosts = self.settings.ingestion_allowed_hosts
        if isinstance(allowed_hosts, str):
            allowed_hosts = [host.strip().lower() for host in allowed_hosts.split(",")]
        if parsed.scheme != "https" or not hostname or hostname not in allowed_hosts:
            raise ValueError("Document URL host is not allowed for ingestion")

        logger.info("Downloading document from signed URL via httpx (timeout=60s)...")
        timeout = httpx.Timeout(60.0, connect=15.0)
        async with httpx.AsyncClient(timeout=timeout, follow_redirects=False) as client:
            async with client.stream("GET", file_url) as response:
                response.raise_for_status()
                content_type = response.headers.get("content-type", "").lower()
                if "pdf" not in content_type and "octet-stream" not in content_type:
                    raise ValueError("Signed URL did not return a PDF")
                chunks: List[bytes] = []
                total = 0
                async for chunk in response.aiter_bytes():
                    total += len(chunk)
                    if total > self.settings.ingestion_max_file_bytes:
                        raise ValueError("PDF exceeds configured ingestion size limit")
                    chunks.append(chunk)
                content = b"".join(chunks)
                if not content.startswith(b"%PDF-"):
                    raise ValueError("Downloaded content failed PDF magic-byte validation")
            logger.info("Downloaded %d bytes successfully.", len(content))
            return content

    async def update_status(
        self,
        document_id: int,
        stage: str,
        progress: int,
        is_active: Optional[bool] = None,
        tenant_id: str = "vnua",
    ) -> bool:
        """Updates document pipeline stage, progress, and active flag in PostgreSQL."""
        await self._ensure_db()
        if is_active is not None:
            query = """
                UPDATE public.documents
                SET pipeline_stage = $2,
                    progress = $3,
                    is_active = $4,
                    updated_at = now()
                WHERE id = $1 AND tenant_id = $5;
            """
            async with get_db_connection(tenant_id) as conn:
                result = await conn.execute(
                    query, document_id, stage, progress, is_active, tenant_id
                )
        else:
            query = """
                UPDATE public.documents
                SET pipeline_stage = $2,
                    progress = $3,
                    updated_at = now()
                WHERE id = $1 AND tenant_id = $4;
            """
            async with get_db_connection(tenant_id) as conn:
                result = await conn.execute(query, document_id, stage, progress, tenant_id)
        return str(result).endswith(" 1")

    async def _get_document_state(
        self, document_id: int, tenant_id: str
    ) -> Optional[Dict[str, Any]]:
        await self._ensure_db()
        async with get_db_connection(tenant_id) as conn:
            row = await conn.fetchrow(
                """
                SELECT id, tenant_id, title, short_title, description, version, validity,
                       pipeline_stage, content_sha256, embedding_model, embedding_dimension,
                       document_number, document_type, issuer, issuing_unit, signed_by,
                       signed_date, issued_date, valid_from, valid_to, validity_status,
                       academic_year, semester, audiences, education_levels, study_modes,
                       faculties, programs, campuses, cohorts, original_filename,
                       markdown_sha256, markdown_path, chunking_version, metadata,
                       metadata_provenance, review_status,
                       (SELECT count(*)
                        FROM public.document_chunks dc
                        WHERE dc.document_id = documents.id
                          AND dc.tenant_id = documents.tenant_id) AS chunk_count
                FROM public.documents
                WHERE id = $1 AND tenant_id = $2
                """,
                document_id,
                tenant_id,
            )
        return dict(row) if row else None

    async def claim_document(self, document_id: int, tenant_id: str) -> bool:
        """Atomically prevent duplicate ingestion jobs for one document."""
        await self._ensure_db()
        async with get_db_connection(tenant_id) as conn:
            result = await conn.execute(
                """
                UPDATE public.documents
                SET pipeline_stage = 'chunking', progress = 10, updated_at = now()
                WHERE id = $1 AND tenant_id = $2
                  AND pipeline_stage NOT IN ('chunking', 'embedding')
                """,
                document_id,
                tenant_id,
            )
        return str(result).endswith(" 1")

    @staticmethod
    def _as_date(value: Any) -> Optional[date]:
        if isinstance(value, datetime):
            return value.date()
        if isinstance(value, date):
            return value
        if isinstance(value, str) and value:
            try:
                return date.fromisoformat(value[:10])
            except ValueError:
                return None
        return None

    @staticmethod
    def _as_datetime(value: Any) -> Optional[datetime]:
        if isinstance(value, datetime):
            return value
        if isinstance(value, date):
            return datetime.combine(value, datetime_time.min, tzinfo=timezone.utc)
        if isinstance(value, str) and value:
            try:
                parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
                return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
            except ValueError:
                try:
                    return datetime.combine(
                        date.fromisoformat(value[:10]),
                        datetime_time.min,
                        tzinfo=timezone.utc,
                    )
                except ValueError:
                    return None
        return None

    async def _store_markdown(
        self,
        document_id: int,
        tenant_id: str,
        artifact: MarkdownArtifact,
        review_status: str,
        parser_used: str = "unknown",
        ocr_page_count: int = 0,
        ocr_confidence: Optional[float] = None,
        ocr_confidence_min: Optional[float] = None,
    ) -> None:
        """Persist the canonical Markdown before any embedding request is made."""
        metadata = artifact.metadata
        markdown_path = f"db://documents/{document_id}/markdown/{artifact.sha256}.md"
        async with get_db_connection(tenant_id) as conn:
            await conn.execute(
                """
                UPDATE public.documents
                SET markdown_content = $3,
                    markdown_path = $4,
                    markdown_sha256 = $5,
                    markdown_generated_at = now(),
                    parser_used = $6,
                    ocr_page_count = $7,
                    ocr_confidence_avg = $8,
                    ocr_confidence_min = $9,
                    review_status = $10,
                    document_number = coalesce(document_number, $11),
                    document_type = CASE
                        WHEN document_type = 'other' THEN coalesce($12, document_type)
                        ELSE document_type
                    END,
                    issued_date = coalesce(issued_date, $13),
                    extraction_version = $14,
                    chunking_version = $15,
                    metadata = coalesce(metadata, '{}'::jsonb) || $16::jsonb,
                    metadata_provenance = coalesce(metadata_provenance, '{}'::jsonb) || $17::jsonb,
                    updated_at = now()
                WHERE id = $1 AND tenant_id = $2
                """,
                document_id,
                tenant_id,
                artifact.content,
                markdown_path,
                artifact.sha256,
                parser_used,
                ocr_page_count,
                ocr_confidence,
                ocr_confidence_min,
                review_status,
                metadata.get("document_number"),
                metadata.get("document_type"),
                self._as_date(metadata.get("issued_date")),
                metadata.get("extraction_version", "legal-md-v1"),
                CHUNKING_VERSION,
                json.dumps(
                    {
                        "semantic_topics": metadata.get("semantic_topics", []),
                        "markdown_format": "canonical_legal_markdown",
                    },
                    ensure_ascii=False,
                ),
                json.dumps(metadata.get("metadata_provenance") or {}, ensure_ascii=False),
            )

    async def _cached_embeddings(
        self, content_hashes: List[str], tenant_id: str
    ) -> Dict[str, List[float]]:
        """Reuse vectors only from the exact model, dimension, tenant and content hash."""
        if not content_hashes:
            return {}
        async with get_db_connection(tenant_id) as conn:
            rows = await conn.fetch(
                """
                SELECT DISTINCT ON (content_hash) content_hash, embedding::text AS embedding
                FROM public.document_chunks
                WHERE tenant_id = $1
                  AND content_hash = ANY($2::text[])
                  AND embedding_model = $3
                  AND embedding_dimension = $4
                  AND embedding IS NOT NULL
                ORDER BY content_hash, created_at DESC
                """,
                tenant_id,
                content_hashes,
                self.settings.embedding_model,
                self.settings.embedding_dimension,
            )
        result: Dict[str, List[float]] = {}
        for row in rows:
            raw = str(row["embedding"]).strip("[]")
            vector = [float(value) for value in raw.split(",") if value]
            if len(vector) == self.settings.embedding_dimension:
                result[str(row["content_hash"])] = vector
        return result

    async def upsert_chunks_to_db(
        self,
        document_id: int,
        chunks: List[DocumentChunk],
        embeddings: List[List[float]],
        tenant_id: str = "vnua",
        document_metadata: Optional[Dict[str, Any]] = None,
        parser_used: str = "unknown",
        document_hash: Optional[str] = None,
        quality: float = 1.0,
    ) -> int:
        """Upserts processed chunks with pgvector embeddings into document_chunks table."""
        await self._ensure_db()
        upsert_query = """
            INSERT INTO public.document_chunks
                (document_id, tenant_id, chunk_index, page, page_start, page_end,
                 tokens, content, search_text, embedding, embedding_model,
                 embedding_dimension, content_hash, heading_path, parser_used,
                 ocr_confidence, knowledge_version, chunk_type, part, chapter,
                 section, article, clause, point, semantic_topics, keywords,
                 entities, markdown_start_offset, markdown_end_offset,
                 is_complete_semantic_unit, split_reason, contains_ocr,
                 embedding_provider, chunking_version, metadata, issued_date,
                 valid_from, valid_to, validity_status, audiences, education_levels,
                 study_modes, faculties, programs, cohorts, embedded_at)
            SELECT $1, $2, $3, $4, $5, $6, $7, $8, $9, $10::vector, $11, $12,
                   $13, $14::jsonb, $15, $16, $17, $18, $19, $20, $21, $22,
                   $23, $24, $25, $26, $27::jsonb, $28, $29, $30, $31, $32,
                   $33, $34, $35::jsonb, $36, $37, $38, $39, $40, $41, $42,
                   $43, $44, $45, now()
            WHERE EXISTS (
                SELECT 1 FROM public.documents WHERE id = $1 AND tenant_id = $2
            )
            ON CONFLICT (document_id, chunk_index) DO UPDATE
            SET page = EXCLUDED.page,
                page_start = EXCLUDED.page_start,
                page_end = EXCLUDED.page_end,
                tenant_id = EXCLUDED.tenant_id,
                tokens = EXCLUDED.tokens,
                content = EXCLUDED.content,
                search_text = EXCLUDED.search_text,
                embedding = EXCLUDED.embedding,
                embedding_model = EXCLUDED.embedding_model,
                embedding_dimension = EXCLUDED.embedding_dimension,
                content_hash = EXCLUDED.content_hash,
                heading_path = EXCLUDED.heading_path,
                parser_used = EXCLUDED.parser_used,
                ocr_confidence = EXCLUDED.ocr_confidence,
                knowledge_version = EXCLUDED.knowledge_version,
                chunk_type = EXCLUDED.chunk_type,
                part = EXCLUDED.part,
                chapter = EXCLUDED.chapter,
                section = EXCLUDED.section,
                article = EXCLUDED.article,
                clause = EXCLUDED.clause,
                point = EXCLUDED.point,
                semantic_topics = EXCLUDED.semantic_topics,
                keywords = EXCLUDED.keywords,
                entities = EXCLUDED.entities,
                markdown_start_offset = EXCLUDED.markdown_start_offset,
                markdown_end_offset = EXCLUDED.markdown_end_offset,
                is_complete_semantic_unit = EXCLUDED.is_complete_semantic_unit,
                split_reason = EXCLUDED.split_reason,
                contains_ocr = EXCLUDED.contains_ocr,
                embedding_provider = EXCLUDED.embedding_provider,
                chunking_version = EXCLUDED.chunking_version,
                metadata = EXCLUDED.metadata,
                issued_date = EXCLUDED.issued_date,
                valid_from = EXCLUDED.valid_from,
                valid_to = EXCLUDED.valid_to,
                validity_status = EXCLUDED.validity_status,
                audiences = EXCLUDED.audiences,
                education_levels = EXCLUDED.education_levels,
                study_modes = EXCLUDED.study_modes,
                faculties = EXCLUDED.faculties,
                programs = EXCLUDED.programs,
                cohorts = EXCLUDED.cohorts,
                embedded_at = EXCLUDED.embedded_at;
        """

        inserted_count = 0
        async with get_db_connection(tenant_id) as conn:
            # Execute in transaction block
            async with conn.transaction():
                version = await conn.fetchval(
                    """
                    INSERT INTO public.ai_knowledge_versions (tenant_id, version)
                    VALUES ($1, 1)
                    ON CONFLICT (tenant_id) DO UPDATE
                    SET version = public.ai_knowledge_versions.version + 1, updated_at = now()
                    RETURNING version
                    """,
                    tenant_id,
                )
                metadata = document_metadata or {}
                for chunk, emb in zip(chunks, embeddings):
                    emb_str = f"[{','.join(str(round(x, 6)) for x in emb)}]"
                    result = await conn.execute(
                        upsert_query,
                        document_id,
                        tenant_id,
                        chunk.chunk_index,
                        chunk.page,
                        chunk.page,
                        chunk.page_end,
                        chunk.tokens,
                        chunk.content,
                        chunk.search_text,
                        emb_str,
                        self.settings.embedding_model,
                        self.settings.embedding_dimension,
                        chunk.content_hash,
                        json.dumps(chunk.heading_path, ensure_ascii=False),
                        parser_used,
                        chunk.ocr_confidence_min,
                        int(version),
                        chunk.kind,
                        chunk.part,
                        chunk.chapter,
                        chunk.section,
                        chunk.article,
                        chunk.clause,
                        chunk.point,
                        chunk.semantic_topics,
                        chunk.keywords,
                        json.dumps(chunk.entities, ensure_ascii=False),
                        chunk.markdown_start_offset,
                        chunk.markdown_end_offset,
                        chunk.is_complete_semantic_unit,
                        chunk.split_reason,
                        chunk.contains_ocr,
                        self.settings.embedding_provider,
                        CHUNKING_VERSION,
                        json.dumps(chunk.metadata, ensure_ascii=False),
                        self._as_date(metadata.get("issued_date")),
                        self._as_datetime(metadata.get("valid_from")),
                        self._as_datetime(metadata.get("valid_to")),
                        metadata.get("validity_status") or "unknown",
                        metadata.get("audiences") or [],
                        metadata.get("education_levels") or [],
                        metadata.get("study_modes") or [],
                        metadata.get("faculties") or [],
                        metadata.get("programs") or [],
                        metadata.get("cohorts") or [],
                    )
                    if result.endswith(" 1"):
                        inserted_count += 1
                await conn.execute(
                    """
                    DELETE FROM public.document_chunks
                    WHERE document_id = $1 AND tenant_id = $2
                      AND NOT (chunk_index = ANY($3::integer[]))
                    """,
                    document_id,
                    tenant_id,
                    [chunk.chunk_index for chunk in chunks],
                )
                await conn.execute(
                    """
                    UPDATE public.document_chunks current_chunk
                    SET previous_chunk_id = (
                            SELECT previous_chunk.id
                            FROM public.document_chunks previous_chunk
                            WHERE previous_chunk.document_id = current_chunk.document_id
                              AND previous_chunk.tenant_id = current_chunk.tenant_id
                              AND previous_chunk.chunk_index = current_chunk.chunk_index - 1
                        ),
                        next_chunk_id = (
                            SELECT next_chunk.id
                            FROM public.document_chunks next_chunk
                            WHERE next_chunk.document_id = current_chunk.document_id
                              AND next_chunk.tenant_id = current_chunk.tenant_id
                              AND next_chunk.chunk_index = current_chunk.chunk_index + 1
                        )
                    WHERE current_chunk.document_id = $1
                      AND current_chunk.tenant_id = $2
                    """,
                    document_id,
                    tenant_id,
                )
                await conn.execute(
                    """
                    UPDATE public.documents
                    SET pipeline_stage = 'ready', progress = 100, is_active = true,
                        content_sha256 = $3, knowledge_version = $4,
                        ingestion_quality = $5, embedding_model = $6,
                        embedding_dimension = $7, review_status = 'approved',
                        updated_at = now()
                    WHERE id = $1 AND tenant_id = $2
                    """,
                    document_id,
                    tenant_id,
                    document_hash,
                    int(version),
                    quality,
                    self.settings.embedding_model,
                    self.settings.embedding_dimension,
                )
                self._knowledge_versions[document_id] = int(version)

        if inserted_count != len(chunks):
            raise ValueError("One or more chunks were rejected by tenant isolation")

        logger.info(
            "Upserted %d chunks into document_chunks for document_id=%d.",
            inserted_count,
            document_id,
        )
        return inserted_count

    async def process_document(
        self,
        document_id: Union[int, str],
        file_url: str,
        job_id: Optional[str] = None,
        tenant_id: str = "vnua",
        already_claimed: bool = False,
    ) -> Dict[str, Any]:
        """Main background ingestion workflow.

        Steps: claim -> bounded download -> native/OCR extraction -> canonical
        Markdown -> legal semantic chunks -> paced embeddings -> transactional upsert.
        """
        start_time = time.perf_counter()
        doc_id = int(document_id)
        job_id = job_id or f"job_{doc_id}_{int(time.time())}"
        parser_used = "unknown"

        logger.info(
            "Starting document ingestion job [%s] for document_id=%d...",
            job_id,
            doc_id,
        )

        try:
            previous = await self._get_document_state(doc_id, tenant_id)
            if previous is None:
                raise ValueError("Document does not exist in the authenticated tenant")

            # 1. Download and content-address the source.
            file_bytes = await self.download_file(file_url)
            document_hash = hashlib.sha256(file_bytes).hexdigest()
            if (
                previous.get("content_sha256") == document_hash
                and previous.get("embedding_model") == self.settings.embedding_model
                and previous.get("embedding_dimension") == self.settings.embedding_dimension
                and previous.get("chunking_version") == CHUNKING_VERSION
                and previous.get("markdown_sha256")
                and int(previous.get("chunk_count") or 0) > 0
            ):
                if already_claimed:
                    await self.update_status(
                        doc_id, stage="ready", progress=100, is_active=True, tenant_id=tenant_id
                    )
                record_ingestion("skipped", "content_hash", time.perf_counter() - start_time)
                return {
                    "status": "ready",
                    "document_id": doc_id,
                    "job_id": job_id,
                    "skipped": True,
                    "reason": "content_hash_unchanged",
                }
            claimed = already_claimed or await self.claim_document(doc_id, tenant_id)
            if not claimed:
                return {
                    "status": "processing",
                    "document_id": doc_id,
                    "job_id": job_id,
                    "skipped": True,
                    "reason": "already_processing",
                }
            await self.update_status(doc_id, stage="chunking", progress=25, tenant_id=tenant_id)

            # 3. Parse PDF into pages (40%)
            parsed_pdf = await asyncio.to_thread(self.pdf_parser.parse, file_bytes)
            parser_used = parsed_pdf.parser_used
            if not parsed_pdf.pages or parsed_pdf.total_chars == 0:
                raise ValueError(f"PDF document {doc_id} contains no extractable text or is empty.")
            quality = (
                parsed_pdf.ocr_confidence_min
                if parsed_pdf.ocr_confidence_min is not None
                else 1.0
            )
            document_metadata = {
                **previous,
                "document_id": doc_id,
                "tenant_id": tenant_id,
                "source_sha256": document_hash,
            }
            artifact = build_legal_markdown(parsed_pdf, document_metadata)
            needs_review = (
                parsed_pdf.ocr_page_count > 0
                and quality < self.settings.ingestion_ocr_min_confidence
                and previous.get("review_status") != "approved"
            )
            await self._store_markdown(
                doc_id,
                tenant_id,
                artifact,
                review_status="needs_review" if needs_review else "approved",
                parser_used=parsed_pdf.parser_used,
                ocr_page_count=parsed_pdf.ocr_page_count,
                ocr_confidence=parsed_pdf.ocr_confidence,
                ocr_confidence_min=parsed_pdf.ocr_confidence_min,
            )
            if needs_review:
                await self.update_status(
                    doc_id, stage="needs_review", progress=50, tenant_id=tenant_id
                )
                record_ingestion(
                    "needs_review",
                    parsed_pdf.parser_used,
                    time.perf_counter() - start_time,
                )
                return {
                    "status": "needs_review",
                    "document_id": doc_id,
                    "job_id": job_id,
                    "ocr_confidence": round(quality, 4),
                    "markdown_sha256": artifact.sha256,
                }
            await self.update_status(doc_id, stage="chunking", progress=40, tenant_id=tenant_id)

            # 4. Chunk only from the canonical Markdown persisted above.
            chunks = self.chunker.chunk_markdown(artifact.content, artifact.metadata)
            if not chunks:
                raise ValueError(f"Chunker produced 0 chunks for document {doc_id}.")
            await self.update_status(doc_id, stage="embedding", progress=60, tenant_id=tenant_id)

            # 5. Generate embeddings with Gemini Embedding 2 (85%)
            cached = await self._cached_embeddings(
                [chunk.content_hash for chunk in chunks], tenant_id
            )
            missing_by_hash = {
                chunk.content_hash: chunk.search_text
                for chunk in chunks
                if chunk.content_hash not in cached
            }
            expected_dimension = self.embedding_service.dimension
            logger.info(
                "Generating %dd Gemini embeddings for %d chunks...",
                expected_dimension,
                len(missing_by_hash),
            )
            if missing_by_hash:
                generated = await self.embedding_service.embed_documents(
                    list(missing_by_hash.values())
                )
                cached.update(dict(zip(missing_by_hash.keys(), generated)))
            embeddings = [cached[chunk.content_hash] for chunk in chunks]

            # Validate dimensions
            for idx, emb in enumerate(embeddings):
                if len(emb) != expected_dimension:
                    raise ValueError(
                        "Embedding dimension mismatch at chunk "
                        f"{idx}: expected {expected_dimension}, got {len(emb)}"
                    )
            await self.update_status(doc_id, stage="embedding", progress=85, tenant_id=tenant_id)

            # 6. Upsert chunks into PostgreSQL table
            await self.upsert_chunks_to_db(
                doc_id,
                chunks,
                embeddings,
                tenant_id=tenant_id,
                document_metadata=artifact.metadata,
                parser_used=parsed_pdf.parser_used,
                document_hash=document_hash,
                quality=quality,
            )

            duration_s = time.perf_counter() - start_time
            record_ingestion("ready", parsed_pdf.parser_used, duration_s)
            logger.info(
                "Ingestion job [%s] completed successfully in %.2fs! Chunks: %d, Pages: %d.",
                job_id,
                duration_s,
                len(chunks),
                parsed_pdf.total_pages,
            )

            return {
                "status": "ready",
                "document_id": doc_id,
                "job_id": job_id,
                "chunks_count": len(chunks),
                "total_pages": parsed_pdf.total_pages,
                "total_characters": parsed_pdf.total_chars,
                "parser_used": parsed_pdf.parser_used,
                "ocr_page_count": parsed_pdf.ocr_page_count,
                "ocr_confidence_min": parsed_pdf.ocr_confidence_min,
                "markdown_sha256": artifact.sha256,
                "duration_seconds": round(duration_s, 2),
                "knowledge_version": self._knowledge_versions.pop(doc_id, None),
                "reused_embeddings": len(chunks) - len(missing_by_hash),
            }

        except Exception as exc:
            self._knowledge_versions.pop(doc_id, None)
            record_ingestion(
                "error",
                parser_used,
                time.perf_counter() - start_time,
            )
            logger.error(
                "Ingestion job [%s] failed for document_id=%d: %s",
                job_id,
                doc_id,
                exc,
                exc_info=True,
            )
            # Mark document as error in DB
            try:
                await self.update_status(doc_id, stage="error", progress=0, tenant_id=tenant_id)
            except Exception as status_err:
                logger.error("Failed to update document error stage: %s", status_err)

            raise
