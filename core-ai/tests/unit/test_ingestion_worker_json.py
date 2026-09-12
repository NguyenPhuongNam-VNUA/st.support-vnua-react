from contextlib import asynccontextmanager
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from core_ai.ingestion.chunker import DocumentChunk, DocumentChunker, MarkdownArtifact
from core_ai.ingestion.worker import IngestionWorker


class _Transaction:
    async def __aenter__(self):
        return self

    async def __aexit__(self, *_args):
        return None


class _Connection:
    def __init__(self) -> None:
        self.calls = []

    def transaction(self) -> _Transaction:
        return _Transaction()

    async def fetchval(self, *_args):
        return 1

    async def execute(self, *args):
        self.calls.append(args)
        return "INSERT 0 1"


@pytest.mark.asyncio
async def test_ingestion_passes_native_json_values_to_asyncpg(monkeypatch) -> None:
    connection = _Connection()

    @asynccontextmanager
    async def fake_connection(_tenant_id):
        yield connection

    monkeypatch.setattr(
        "core_ai.ingestion.worker.get_db_connection",
        fake_connection,
    )

    worker = object.__new__(IngestionWorker)
    worker.settings = SimpleNamespace(
        embedding_model="gemini-embedding-2",
        embedding_dimension=1024,
        embedding_provider="gemini",
    )
    worker._ensure_db = AsyncMock()
    worker._knowledge_versions = {}

    artifact = MarkdownArtifact(
        content="# Học phí\nNội dung",
        sha256="markdown-sha",
        metadata={
            "semantic_topics": ["hoc_phi"],
            "metadata_provenance": {"title": {"value_source": "admin"}},
        },
    )
    await worker._store_markdown(1, "vnua", artifact, "approved")
    markdown_call = connection.calls[-1]
    assert markdown_call[16] == {
        "semantic_topics": ["hoc_phi"],
        "markdown_format": "canonical_legal_markdown",
    }
    assert markdown_call[17] == {"title": {"value_source": "admin"}}

    chunk = DocumentChunk(
        chunk_index=0,
        page=1,
        tokens=10,
        content="Nội dung",
        heading_path=["Học phí"],
        entities={"dates": []},
        metadata={"source_blocks": 1},
    )
    await worker.upsert_chunks_to_db(1, [chunk], [[0.0] * 1024])
    chunk_call = next(
        call for call in connection.calls if "INSERT INTO public.document_chunks" in call[0]
    )
    assert chunk_call[14] == ["Học phí"]
    assert chunk_call[27] == {"dates": []}
    assert chunk_call[35] == {"source_blocks": 1}


@pytest.mark.asyncio
async def test_reindex_stored_markdown_skips_pdf_and_reuses_pipeline() -> None:
    worker = object.__new__(IngestionWorker)
    worker.settings = SimpleNamespace(
        embedding_model="gemini-embedding-2",
        embedding_dimension=2,
    )
    worker.chunker = DocumentChunker()
    worker.embedding_service = SimpleNamespace(
        dimension=2,
        embed_documents=AsyncMock(return_value=[[0.1, 0.2]]),
    )
    worker._knowledge_versions = {}
    worker._get_document_state = AsyncMock(return_value={
        "id": 1,
        "tenant_id": "vnua",
        "title": "Quy chế học vụ",
        "markdown_content": "# Điều 1\nSinh viên đăng ký học phần trực tuyến.\n",
        "content_sha256": "pdf-sha",
        "ingestion_quality": 1.0,
        "ocr_page_count": 0,
    })
    worker.download_file = AsyncMock()
    worker.update_status = AsyncMock(return_value=True)
    worker._cached_embeddings = AsyncMock(return_value={})
    worker.upsert_chunks_to_db = AsyncMock(return_value=1)

    result = await worker.process_document(
        1,
        "",
        tenant_id="vnua",
        already_claimed=True,
        use_stored_markdown=True,
    )

    worker.download_file.assert_not_awaited()
    worker.upsert_chunks_to_db.assert_awaited_once()
    assert worker.upsert_chunks_to_db.await_args.kwargs["parser_used"] == "admin_markdown"
    assert result["status"] == "ready"
    assert result["chunks_count"] == 1
