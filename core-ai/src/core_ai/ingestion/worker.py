"""Offline Document Ingestion Worker for ST-Care.

Processes PDF documents asynchronously in the background:
1. Downloads PDF from short-lived signed URL via httpx (or reads local path).
2. Extracts page-by-page text using PDFParser (pdfplumber with pypdf fallback).
3. Splits text using sliding window DocumentChunker (500-800 tokens, 100 token overlap).
4. Generates 1024-dimensional dense vectors with Gemini Embedding 2.
5. Upserts chunk records into PostgreSQL `document_chunks` table.
6. Updates `documents` row lifecycle: pipeline_stage = 'ready', progress = 100, is_active = true.
"""

import asyncio
import logging
from pathlib import Path
import time
from typing import Any, Dict, List, Optional, Union

import httpx

from core_ai.config import Settings, get_settings
from core_ai.data.postgres import get_db_connection, init_db_pool
from core_ai.data.repositories.document_repo import ChunkCreate, DocumentRepository
from core_ai.ingestion.chunker import DocumentChunk, DocumentChunker
from core_ai.ingestion.pdf_parser import PDFParser, ParsedPDF
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
        self.pdf_parser = pdf_parser or PDFParser()
        self.chunker = chunker or DocumentChunker(
            min_tokens=500,
            max_tokens=800,
            target_tokens=650,
            overlap_tokens=100,
        )
        self.embedding_service = embedding_service or GeminiEmbedding2Embeddings(
            settings=self.settings
        )
        self.doc_repo = doc_repo or DocumentRepository(settings=self.settings)

    async def _ensure_db(self) -> None:
        """Ensures the database connection pool is active."""
        try:
            from core_ai.data.postgres import get_db_pool

            get_db_pool()
        except Exception:
            await init_db_pool(self.settings)

    async def download_file(self, file_url: str) -> bytes:
        """Downloads document bytes from signed URL via httpx or reads local filesystem path."""
        # 1. Handle local file paths
        if not file_url.startswith(("http://", "https://")):
            path_obj = Path(file_url)
            if not path_obj.exists():
                raise FileNotFoundError(f"Local document file not found: {file_url}")
            return await asyncio.to_thread(path_obj.read_bytes)

        # 2. Handle remote signed URL via httpx
        logger.info("Downloading document from signed URL via httpx (timeout=60s)...")
        timeout = httpx.Timeout(60.0, connect=15.0)
        async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
            response = await client.get(file_url)
            response.raise_for_status()
            content = response.content
            logger.info("Downloaded %d bytes successfully.", len(content))
            return content

    async def update_status(
        self,
        document_id: int,
        stage: str,
        progress: int,
        is_active: Optional[bool] = None,
    ) -> None:
        """Updates document pipeline stage, progress, and active flag in PostgreSQL."""
        await self._ensure_db()
        if is_active is not None:
            query = """
                UPDATE public.documents
                SET pipeline_stage = $2,
                    progress = $3,
                    is_active = $4,
                    updated_at = now()
                WHERE id = $1;
            """
            async with get_db_connection() as conn:
                await conn.execute(query, document_id, stage, progress, is_active)
        else:
            query = """
                UPDATE public.documents
                SET pipeline_stage = $2,
                    progress = $3,
                    updated_at = now()
                WHERE id = $1;
            """
            async with get_db_connection() as conn:
                await conn.execute(query, document_id, stage, progress)

    async def upsert_chunks_to_db(
        self,
        document_id: int,
        chunks: List[DocumentChunk],
        embeddings: List[List[float]],
    ) -> int:
        """Upserts processed chunks with pgvector embeddings into document_chunks table."""
        await self._ensure_db()
        upsert_query = """
            INSERT INTO public.document_chunks (document_id, chunk_index, page, tokens, content, embedding)
            VALUES ($1, $2, $3, $4, $5, $6::vector)
            ON CONFLICT (document_id, chunk_index) DO UPDATE
            SET page = EXCLUDED.page,
                tokens = EXCLUDED.tokens,
                content = EXCLUDED.content,
                embedding = EXCLUDED.embedding;
        """

        inserted_count = 0
        async with get_db_connection() as conn:
            # Execute in transaction block
            async with conn.transaction():
                for chunk, emb in zip(chunks, embeddings):
                    emb_str = f"[{','.join(str(round(x, 6)) for x in emb)}]"
                    await conn.execute(
                        upsert_query,
                        document_id,
                        chunk.chunk_index,
                        chunk.page,
                        chunk.tokens,
                        chunk.content,
                        emb_str,
                    )
                    inserted_count += 1

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
    ) -> Dict[str, Any]:
        """Main background ingestion workflow.

        Steps:
        1. Set status: chunking (10%)
        2. Download file via httpx (25%)
        3. Parse PDF with pdfplumber/pypdf (40%)
        4. Chunk with sliding window (60%)
        5. Generate 1024d embeddings (85%)
        6. Upsert to document_chunks table (95%)
        7. Set status: ready, progress: 100, is_active: True (100%)
        """
        start_time = time.perf_counter()
        doc_id = int(document_id)
        job_id = job_id or f"job_{doc_id}_{int(time.time())}"

        logger.info(
            "Starting document ingestion job [%s] for document_id=%d...",
            job_id,
            doc_id,
        )

        try:
            # 1. Update status to chunking (10%)
            await self.update_status(doc_id, stage="chunking", progress=10)

            # 2. Download file via httpx (25%)
            file_bytes = await self.download_file(file_url)
            await self.update_status(doc_id, stage="chunking", progress=25)

            # 3. Parse PDF into pages (40%)
            parsed_pdf = await asyncio.to_thread(self.pdf_parser.parse, file_bytes)
            if not parsed_pdf.pages or parsed_pdf.total_chars == 0:
                raise ValueError(
                    f"PDF document {doc_id} contains no extractable text or is empty."
                )
            await self.update_status(doc_id, stage="chunking", progress=40)

            # 4. Chunk with sliding window (60%)
            chunks = self.chunker.chunk_pdf(parsed_pdf)
            if not chunks:
                raise ValueError(
                    f"Chunker produced 0 chunks for document {doc_id}."
                )
            await self.update_status(doc_id, stage="embedding", progress=60)

            # 5. Generate embeddings with Gemini Embedding 2 (85%)
            chunk_texts = [c.content for c in chunks]
            expected_dimension = self.embedding_service.dimension
            logger.info(
                "Generating %dd Gemini embeddings for %d chunks...",
                expected_dimension,
                len(chunk_texts),
            )
            embeddings = await self.embedding_service.embed_documents(chunk_texts)

            # Validate dimensions
            for idx, emb in enumerate(embeddings):
                if len(emb) != expected_dimension:
                    raise ValueError(
                        "Embedding dimension mismatch at chunk "
                        f"{idx}: expected {expected_dimension}, got {len(emb)}"
                    )
            await self.update_status(doc_id, stage="embedding", progress=85)

            # 6. Upsert chunks into PostgreSQL table
            await self.upsert_chunks_to_db(doc_id, chunks, embeddings)

            # 7. Final status update: ready, progress 100, is_active = true
            await self.update_status(
                doc_id,
                stage="ready",
                progress=100,
                is_active=True,
            )

            duration_s = time.perf_counter() - start_time
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
                "duration_seconds": round(duration_s, 2),
            }

        except Exception as exc:
            logger.error(
                "Ingestion job [%s] failed for document_id=%d: %s",
                job_id,
                doc_id,
                exc,
                exc_info=True,
            )
            # Mark document as error in DB
            try:
                await self.update_status(doc_id, stage="error", progress=0)
            except Exception as status_err:
                logger.error("Failed to update document error stage: %s", status_err)

            raise
