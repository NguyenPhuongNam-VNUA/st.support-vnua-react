"""Build a content-addressed BM25 artifact and publish it atomically."""

from __future__ import annotations

import argparse
import asyncio
import hashlib
import json
import os
import tempfile
from pathlib import Path

from core_ai.config import get_settings
from core_ai.data.postgres import close_db_pool, get_db_connection, init_db_pool
from core_ai.retrieval.bm25 import BM25Okapi, tokenize_vietnamese


async def run(tenant_id: str, output: Path) -> None:
    settings = get_settings()
    await init_db_pool(settings)
    async with get_db_connection(tenant_id) as conn:
        rows = await conn.fetch(
            """
            SELECT dc.id, dc.document_id, dc.chunk_index, dc.page, dc.content,
                   d.title, dc.knowledge_version
            FROM public.document_chunks dc
            JOIN public.documents d ON d.id = dc.document_id AND d.tenant_id = dc.tenant_id
            WHERE dc.tenant_id = $1 AND d.is_active = true AND d.pipeline_stage = 'ready'
            ORDER BY dc.id
            """,
            tenant_id,
        )
    corpus = [tokenize_vietnamese(str(row["content"])) for row in rows]
    scorer = BM25Okapi(corpus)
    documents = [dict(row) for row in rows]
    payload = {
        "tenant_id": tenant_id,
        "embedding_model": settings.embedding_model,
        "knowledge_version": max((int(row["knowledge_version"]) for row in rows), default=1),
        "idf": scorer.idf,
        "documents": documents,
        "tokens": corpus,
    }
    encoded = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    envelope = {"sha256": hashlib.sha256(encoded).hexdigest(), "payload": payload}
    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(
        "w", encoding="utf-8", dir=output.parent, delete=False
    ) as handle:
        json.dump(envelope, handle, ensure_ascii=False)
        temp_name = handle.name
    os.replace(temp_name, output)
    await close_db_pool()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--tenant", default="vnua")
    parser.add_argument("--output", default="./data/bm25/vnua.json")
    args = parser.parse_args()
    asyncio.run(run(args.tenant, Path(args.output)))
