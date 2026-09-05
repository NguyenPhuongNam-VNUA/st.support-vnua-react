"""Embed versioned topic prototypes offline and publish them to PostgreSQL."""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import tempfile
from pathlib import Path

from core_ai.config import get_settings
from core_ai.data.postgres import close_db_pool, get_db_connection, init_db_pool
from core_ai.retrieval.embeddings import GeminiEmbedding2Embeddings
from core_ai.retrieval.topic_anchors import TOPICS


async def run(tenant_id: str, output: Path) -> None:
    settings = get_settings()
    await init_db_pool(settings)
    embedder = GeminiEmbedding2Embeddings(settings=settings)
    topics = list(TOPICS)
    prototypes = [f"Chủ đề {topic}: " + ", ".join(TOPICS[topic]["keywords"]) for topic in topics]
    vectors = await embedder.embed_documents(prototypes)
    payload = {
        "tenant_id": tenant_id,
        "embedding_model": settings.embedding_model,
        "embedding_dimension": settings.embedding_dimension,
        "anchors": dict(zip(topics, vectors)),
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(
        "w", encoding="utf-8", dir=output.parent, delete=False
    ) as handle:
        json.dump(payload, handle, ensure_ascii=False)
        temp_name = handle.name
    os.replace(temp_name, output)
    async with get_db_connection(tenant_id) as conn:
        async with conn.transaction():
            for topic, vector in zip(topics, vectors):
                vector_text = f"[{','.join(str(value) for value in vector)}]"
                await conn.execute(
                    """
                    INSERT INTO public.ai_topic_anchors
                        (tenant_id, topic, embedding, embedding_model, embedding_dimension)
                    VALUES ($1, $2, $3::vector, $4, $5)
                    ON CONFLICT (tenant_id, topic, embedding_model, embedding_dimension)
                    DO UPDATE SET embedding = EXCLUDED.embedding, updated_at = now()
                    """,
                    tenant_id,
                    topic,
                    vector_text,
                    settings.embedding_model,
                    settings.embedding_dimension,
                )
    await close_db_pool()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--tenant", default="vnua")
    parser.add_argument("--output", default="./data/topic_anchors.json")
    args = parser.parse_args()
    asyncio.run(run(args.tenant, Path(args.output)))
