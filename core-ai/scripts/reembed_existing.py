"""Rebuild all legacy vectors in the Gemini Embedding 2 space with rate limiting and retry.

Features:
- Rate limiting: 2s per embedding request (configurable via --delay)
- Exponential backoff retry on failure/timeout: 3 attempts (2s, 4s, 8s)
- Automatic skip if still failing after 3 retries, continuing to the next record
- Immediate per-record database updates to preserve progress
- Table selection: --table questions | document_chunks | all (default: all)

Usage:
    uv run python scripts/reembed_existing.py --tenant vnua --table questions --delay 2.0
"""

import argparse
import asyncio
import sys
import time
from pathlib import Path
from typing import List, Optional, Tuple

# Ensure src/ is on sys.path
repo_root = Path(__file__).resolve().parent.parent
src_path = repo_root / "src"
if str(src_path) not in sys.path:
    sys.path.insert(0, str(src_path))

from core_ai.config import get_settings
from core_ai.data.postgres import close_db_pool, get_db_connection, init_db_pool
from core_ai.retrieval.embeddings import GeminiEmbedding2Embeddings


def _vector_literal(values: List[float]) -> str:
    return f"[{','.join(str(round(value, 7)) for value in values)}]"


async def _embed_single_with_retry(
    embedder: GeminiEmbedding2Embeddings,
    text: str,
    record_id: int,
    retry_delays: Tuple[float, ...] = (2.0, 4.0, 8.0),
) -> Optional[List[float]]:
    """Calls embedding API with exponential backoff on failure/timeout (2s, 4s, 8s)."""
    attempt = 0
    max_retries = len(retry_delays)

    while True:
        try:
            vectors = await embedder.embed_documents([text])
            if vectors and len(vectors) > 0:
                return vectors[0]
            raise RuntimeError("Empty vector returned from Gemini embedding API")
        except Exception as exc:
            attempt += 1
            if attempt > max_retries:
                print(
                    f"  ❌ [ID: {record_id}] Thất bại sau {max_retries} lần thử lại ({exc}). Bỏ qua."
                )
                return None
            backoff = retry_delays[attempt - 1]
            print(
                f"  ⚠️ [ID: {record_id}] Lỗi/Timeout: {exc}. "
                f"Thử lại lần {attempt}/{max_retries} sau {backoff}s..."
            )
            await asyncio.sleep(backoff)


async def _reembed_table(
    *,
    table: str,
    text_column: str,
    tenant_id: str,
    batch_size: int,
    delay_between_requests: float,
    embedder: GeminiEmbedding2Embeddings,
) -> Tuple[int, int, List[int]]:
    if table not in ("document_chunks", "questions"):
        raise ValueError("Unsupported re-embedding table")

    tenant_predicate = "source.tenant_id = $1"

    # 1. Đếm tổng số bản ghi cần embed
    count_sql = f"""
        select count(*)
        from public.{table} source
        where {tenant_predicate}
          and nullif(btrim(source.{text_column}), '') is not null
          and (
            source.embedding is null
            or source.embedding_model is distinct from $2
            or source.embedding_dimension is distinct from $3
          )
    """
    async with get_db_connection(tenant_id) as connection:
        total_pending = await connection.fetchval(
            count_sql, tenant_id, embedder.model_name, embedder.dimension
        )

    if not total_pending:
        print(f"👉 Bảng '{table}': Không có bản ghi nào cần embed (tất cả đã có vector hợp lệ).")
        return 0, 0, []

    print(
        f"\n🚀 Bắt đầu re-embed bảng '{table}': "
        f"{total_pending} bản ghi cần xử lý (Rate limit: {delay_between_requests}s/req)..."
    )

    success_count = 0
    skipped_ids: List[int] = []
    processed_count = 0
    last_id = 0

    update_sql = f"""
        update public.{table}
        set embedding = $2::vector,
            embedding_model = $3,
            embedding_dimension = $4
        where id = $1 and tenant_id = $5
    """

    while True:
        select_sql = f"""
            select source.id, source.{text_column} as source_text
            from public.{table} source
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

        for row in rows:
            row_id = int(row["id"])
            last_id = row_id
            processed_count += 1
            raw_text = str(row["source_text"] or "").strip()
            preview = (raw_text[:50] + "...") if len(raw_text) > 50 else raw_text

            start_t = time.time()
            vector = await _embed_single_with_retry(embedder, raw_text, row_id)
            elapsed = time.time() - start_t

            if vector is not None:
                # Lưu ngay vào database
                async with get_db_connection(tenant_id) as connection:
                    await connection.execute(
                        update_sql,
                        row_id,
                        _vector_literal(vector),
                        embedder.model_name,
                        embedder.dimension,
                        tenant_id,
                    )
                success_count += 1
                print(
                    f"[{processed_count}/{total_pending}] ID {row_id}: "
                    f"✅ Thành công ({elapsed:.2f}s) - \"{preview}\""
                )
            else:
                skipped_ids.append(row_id)
                print(
                    f"[{processed_count}/{total_pending}] ID {row_id}: "
                    f"⏭️ Bỏ qua bản ghi này sau 3 lần thử lại."
                )

            # Delay giữa các request
            if processed_count < total_pending and delay_between_requests > 0:
                await asyncio.sleep(delay_between_requests)

    print(
        f"\n✨ Hoàn thành bảng '{table}': "
        f"{success_count}/{total_pending} thành công, {len(skipped_ids)} bỏ qua."
    )
    if skipped_ids:
        print(f"⚠️ Các ID bị bỏ qua: {skipped_ids}")

    return success_count, len(skipped_ids), skipped_ids


async def main(tenant_id: str, table: str, batch_size: int, delay: float) -> None:
    settings = get_settings()
    allowed = settings.allowed_tenants
    if isinstance(allowed, str):
        allowed = [item.strip() for item in allowed.split(",") if item.strip()]
    if tenant_id not in allowed:
        raise ValueError(f"Tenant '{tenant_id}' không nằm trong ALLOWED_TENANTS ({allowed})")

    await init_db_pool(settings)
    try:
        embedder = GeminiEmbedding2Embeddings(settings=settings)
        print("=" * 70)
        print("ST-Care Core AI — Re-embedding Data Runner")
        print(f"Tenant        : {tenant_id}")
        print(f"Table(s)      : {table}")
        print(f"Model         : {embedder.model_name} ({embedder.dimension}d)")
        print(f"Rate Limit    : {delay}s / 1 request")
        print("Retry Policy  : 3 lần thử lại nếu lỗi/timeout (lần 1: 2s, lần 2: 4s, lần 3: 8s)")
        print("=" * 70)

        tables_to_run = []
        if table in ("document_chunks", "all"):
            tables_to_run.append(("document_chunks", "content"))
        if table in ("questions", "all"):
            tables_to_run.append(("questions", "question"))

        total_success = 0
        total_skipped = 0
        all_skipped: List[int] = []

        for tbl_name, col_name in tables_to_run:
            succ, skip, skipped_list = await _reembed_table(
                table=tbl_name,
                text_column=col_name,
                tenant_id=tenant_id,
                batch_size=batch_size,
                delay_between_requests=delay,
                embedder=embedder,
            )
            total_success += succ
            total_skipped += skip
            all_skipped.extend(skipped_list)

        print("\n" + "=" * 70)
        print(f"TỔNG KẾT: {total_success} thành công, {total_skipped} bỏ qua.")
        if all_skipped:
            print(f"Danh sách ID chưa thể embed: {all_skipped}")
        print("=" * 70)
    finally:
        await close_db_pool()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Re-embed data with rate-limiting and retry policy"
    )
    parser.add_argument("--tenant", default="vnua", help="Tenant ID (default: vnua)")
    parser.add_argument(
        "--table",
        choices=["questions", "document_chunks", "all"],
        default="all",
        help="Table to re-embed: 'questions', 'document_chunks', or 'all' (default: all)",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=100,
        help="Batch size for fetching records from DB (default: 100)",
    )
    parser.add_argument(
        "--delay",
        type=float,
        default=2.0,
        help="Delay between requests in seconds (default: 2.0)",
    )
    args = parser.parse_args()
    if not 1 <= args.batch_size <= 1000:
        raise ValueError("--batch-size must be between 1 and 1000")
    if args.delay < 0:
        raise ValueError("--delay must be non-negative")

    asyncio.run(main(args.tenant, args.table, args.batch_size, args.delay))

