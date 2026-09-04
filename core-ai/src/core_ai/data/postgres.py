"""PostgreSQL database connection pool manager for ST-Care Core AI.

Configured specifically for Supavisor Transaction Pooler (port 6543) using asyncpg
with statement_cache_size=0 to eliminate prepared statement collisions.
"""

from contextlib import asynccontextmanager
import logging
from typing import AsyncGenerator, Optional
import asyncpg

from core_ai.config import Settings, get_settings
from core_ai.contracts.errors import DatabaseUnavailableError
from core_ai.observability.metrics import record_db_pool_usage

logger = logging.getLogger("core_ai.data.postgres")

# Global singleton connection pool
_db_pool: Optional[asyncpg.Pool] = None


async def init_db_pool(settings: Optional[Settings] = None) -> asyncpg.Pool:
    """Initialize the asyncpg connection pool with Supavisor transaction pooler configuration.

    CRITICAL:
        statement_cache_size=0 is strictly required when connecting via Supavisor
        transaction pooler (port 6543) because individual transactions may be routed
        to different backend PostgreSQL processes.
    """
    global _db_pool
    if _db_pool is not None and not _db_pool.is_closing():
        logger.debug("Reusing existing PostgreSQL connection pool.")
        return _db_pool

    app_settings = settings or get_settings()
    logger.info(
        "Initializing PostgreSQL connection pool via Supavisor (min=%d, max=%d, timeout=%.1fs)...",
        app_settings.db_pool_min_size,
        app_settings.db_pool_max_size,
        app_settings.db_command_timeout_seconds,
    )

    try:
        _db_pool = await asyncpg.create_pool(
            dsn=app_settings.database_url,
            min_size=app_settings.db_pool_min_size,
            max_size=app_settings.db_pool_max_size,
            command_timeout=app_settings.db_command_timeout_seconds,
            statement_cache_size=app_settings.db_statement_cache_size,  # Strictly 0 for Supavisor
            max_cached_statement_lifetime=0,
        )
        logger.info("PostgreSQL connection pool successfully initialized.")
        return _db_pool
    except Exception as exc:
        logger.error("Failed to initialize PostgreSQL connection pool: %s", exc, exc_info=True)
        raise DatabaseUnavailableError(
            message="Không thể khởi tạo pool kết nối PostgreSQL"
        ) from exc


async def close_db_pool() -> None:
    """Gracefully terminate all connections in the pool."""
    global _db_pool
    if _db_pool is not None:
        logger.info("Closing PostgreSQL connection pool...")
        await _db_pool.close()
        _db_pool = None
        logger.info("PostgreSQL connection pool closed.")


def get_db_pool() -> asyncpg.Pool:
    """Retrieve the initialized global connection pool singleton.

    Raises:
        DatabaseUnavailableError: If the pool has not been initialized.
    """
    global _db_pool
    if _db_pool is None or _db_pool.is_closing():
        raise DatabaseUnavailableError(
            message="PostgreSQL connection pool chưa được khởi tạo hoặc đã bị đóng."
        )
    return _db_pool


@asynccontextmanager
async def get_db_connection(
    tenant_id: Optional[str] = None,
) -> AsyncGenerator[asyncpg.Connection, None]:
    """Acquire a managed connection from the pool and ensure clean release.

    RULE: Connections must NEVER be held across external network calls (LLM, MCP).
    """
    pool = get_db_pool()
    connection: Optional[asyncpg.Connection] = None
    transaction: Optional[asyncpg.Transaction] = None
    try:
        connection = await pool.acquire()
        record_db_pool_usage(pool.get_size() - pool.get_idle_size())
        if tenant_id is not None:
            transaction = connection.transaction()
            await transaction.start()
            await connection.execute(
                "SELECT set_config('app.tenant_id', $1, true);",
                tenant_id,
            )
        yield connection
        if transaction is not None:
            await transaction.commit()
    except asyncpg.PostgresError as pg_err:
        if transaction is not None:
            try:
                await transaction.rollback()
            except Exception:
                logger.exception("Failed to roll back tenant-scoped transaction")
        logger.error("Postgres error executing query: %s", pg_err)
        raise DatabaseUnavailableError(message="Cơ sở dữ liệu tạm thời không khả dụng") from pg_err
    except Exception as exc:
        if transaction is not None:
            try:
                await transaction.rollback()
            except Exception:
                logger.exception("Failed to roll back tenant-scoped transaction")
        logger.error("Unexpected error acquiring/using DB connection: %s", exc)
        raise DatabaseUnavailableError(message="Kết nối cơ sở dữ liệu tạm thời không khả dụng") from exc
    finally:
        if connection is not None:
            await pool.release(connection)
            record_db_pool_usage(pool.get_size() - pool.get_idle_size())


async def check_db_health(timeout: float = 2.0) -> bool:
    """Execute a fast health-check query (SELECT 1) against the database.

    Returns True if healthy, False if down or times out.
    """
    try:
        pool = get_db_pool()
        async with pool.acquire(timeout=timeout) as conn:
            result = await conn.fetchval("SELECT 1;")
            return result == 1
    except Exception as exc:
        logger.warning("PostgreSQL health check probe failed: %s", exc)
        return False
