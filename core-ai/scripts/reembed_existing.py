"""Rebuild all legacy vectors in the Gemini Embedding 2 space.

Run after applying the tenant/embedding metadata migration:
    uv run python scripts/reembed_existing.py --tenant vnua
"""

import argparse
import asyncio
from typing import List

from core_ai.config import get_settings
from core_ai.data.postgres import close_db_pool, get_db_connection, init_db_pool
from core_ai.retrieval.embeddings import GeminiEmbedding2Embeddings


def _vector_literal(values: List[float]) -> str:
    return f"[{','.join(str(round(value, 7)) for value in values)}]"


async def _reembed_table(
    *,
    table: str,
    text_column: str,
    tenant_id: str,
    batch_size: int,
    embedder: GeminiEmbedding2Embeddings,
) -> int:
    if table == "document_chunks":
        tenant_join = ""
        tenant_predicate = "source.tenant_id = $1"
    elif table == "questions":
        tenant_join = ""
        tenant_predicate = "source.tenant_id = $1"
    else:
        raise ValueError("Unsupported re-embedding table")

    total = 0
    last_id = 0
    while True:
        select_sql = f"""
            select source.id, source.{text_column} as source_text
            from public.{table} source
            {tenant_join}
            where {tenant_predicate}
              and source.id > $2
              and nullif(btrim(source.{text_column}), '') is not null
              and (
                source.embedding is null
                or source.embedding_model is distinct from $3
                or source.embedding_dimension is distinct from $4
              )
            order by source.id
            limit $5
        """
        async with get_db_connection(tenant_id) as connection:
            rows = await connection.fetch(
                select_sql,
                tenant_id,
                last_id,
                embedder.model_name,
                embedder.dimension,
                batch_size,
            )
        if not rows:
            break

        texts = [str(row["source_text"] or "").strip() for row in rows]
        vectors = await embedder.embed_documents(texts)
        update_sql = f"""
            update public.{table}
            set embedding = $2::vector,
                embedding_model = $3,
                embedding_dimension = $4
            where id = $1 and tenant_id = $5
        """
        async with get_db_connection(tenant_id) as connection:
            async with connection.transaction():
                for row, vector in zip(rows, vectors):
                    await connection.execute(
                        update_sql,
                        row["id"],
                        _vector_literal(vector),
                        embedder.model_name,
                        embedder.dimension,
                        tenant_id,
                    )
        last_id = int(rows[-1]["id"])
        total += len(rows)
        print(f"{table}: rebuilt {total} vectors")
    return total


async def main(tenant_id: str, batch_size: int) -> None:
    settings = get_settings()
    allowed = settings.allowed_tenants
    if isinstance(allowed, str):
        allowed = [item.strip() for item in allowed.split(",") if item.strip()]
    if tenant_id not in allowed:
        raise ValueError("Tenant is not in ALLOWED_TENANTS")

    await init_db_pool(settings)
    try:
        embedder = GeminiEmbedding2Embeddings(settings=settings)
        chunks = await _reembed_table(
            table="document_chunks",
            text_column="content",
            tenant_id=tenant_id,
            batch_size=batch_size,
            embedder=embedder,
        )
        questions = await _reembed_table(
            table="questions",
            text_column="question",
            tenant_id=tenant_id,
            batch_size=batch_size,
            embedder=embedder,
        )
        print(f"Completed: {chunks} chunks, {questions} questions")
    finally:
        await close_db_pool()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--tenant", required=True)
    parser.add_argument("--batch-size", type=int, default=50)
    args = parser.parse_args()
    if not 1 <= args.batch_size <= 500:
        raise ValueError("--batch-size must be between 1 and 500")
    asyncio.run(main(args.tenant, args.batch_size))
