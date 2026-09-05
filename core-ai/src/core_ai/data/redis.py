"""Redis client manager and distributed primitives for ST-Care Core AI.

Provides connection pooling, degraded-safe operations (pipeline continues even if Redis is down),
and distributed locking to prevent cache stampedes during LLM generation.
"""

import logging
from typing import Optional

import redis.asyncio as aioredis

from core_ai.config import Settings, get_settings

logger = logging.getLogger("core_ai.data.redis")

# Global singleton Redis client
_redis_client: Optional[aioredis.Redis] = None
_redis_degraded: bool = False

# Safe Lua script for atomic distributed lock release
RELEASE_LOCK_LUA = """
if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("del", KEYS[1])
else
    return 0
end
"""


async def init_redis_client(settings: Optional[Settings] = None) -> Optional[aioredis.Redis]:
    """Initialize the async Redis client with connection pooling and degradation fallback.

    If Redis is unreachable during startup, logs a warning and marks degraded mode rather
    than crashing the microservice.
    """
    global _redis_client, _redis_degraded
    if _redis_client is not None:
        return _redis_client

    app_settings = settings or get_settings()
    logger.info(
        "Initializing Redis client at %s (max_connections=%d)...",
        app_settings.redis_url,
        app_settings.redis_max_connections,
    )

    try:
        pool = aioredis.ConnectionPool.from_url(
            app_settings.redis_url,
            max_connections=app_settings.redis_max_connections,
            decode_responses=True,
            socket_timeout=2.0,
            socket_connect_timeout=2.0,
        )
        client = aioredis.Redis(connection_pool=pool)
        # Test connection with ping
        await client.ping()
        _redis_client = client
        _redis_degraded = False
        logger.info("Redis client successfully initialized and verified.")
        return _redis_client
    except Exception as exc:
        logger.warning(
            "Redis connection failed during initialization: %s. Operating in degraded mode (cache disabled).",
            exc,
        )
        _redis_degraded = True
        _redis_client = None
        return None


async def close_redis_client() -> None:
    """Gracefully terminate the Redis connection pool."""
    global _redis_client, _redis_degraded
    if _redis_client is not None:
        logger.info("Closing Redis client...")
        try:
            await _redis_client.aclose()
        except Exception as exc:
            logger.warning("Error closing Redis client: %s", exc)
        finally:
            _redis_client = None
            _redis_degraded = False
            logger.info("Redis client closed.")


def get_redis_client() -> Optional[aioredis.Redis]:
    """Retrieve active Redis client singleton, or None if in degraded mode."""
    return _redis_client


def is_redis_degraded() -> bool:
    """Return True if Redis is currently unavailable or degraded."""
    return _redis_degraded or (_redis_client is None)


async def check_redis_health() -> bool:
    """Ping Redis to verify connectivity with 1.0s timeout."""
    global _redis_degraded
    if _redis_client is None:
        return False
    try:
        res = await _redis_client.ping()
        _redis_degraded = not res
        return bool(res)
    except Exception as exc:
        logger.warning("Redis health check probe failed: %s", exc)
        _redis_degraded = True
        return False


async def acquire_lock(lock_key: str, token: str, ttl_seconds: int = 15) -> bool:
    """Acquire a distributed lock with TTL to prevent cache stampedes.

    Args:
        lock_key: Redis key for the lock (e.g. 'lock:cache:...')
        token: Unique token/uuid for owner identification
        ttl_seconds: Lock expiry in seconds (default 15s)

    Returns:
        True if lock was acquired, False if already held or Redis is down.
    """
    client = get_redis_client()
    if client is None:
        # In degraded mode, don't block execution
        return True

    try:
        # SET key token NX EX ttl
        acquired = await client.set(lock_key, token, nx=True, ex=ttl_seconds)
        return bool(acquired)
    except Exception as exc:
        logger.warning("Failed to acquire distributed lock '%s': %s (bypassing lock)", lock_key, exc)
        return True  # Fallback to avoid stalling requests


async def release_lock(lock_key: str, token: str) -> bool:
    """Atomically release distributed lock only if token matches.

    Args:
        lock_key: Redis key for the lock
        token: Unique token passed when acquiring

    Returns:
        True if released, False if token mismatch or already expired.
    """
    client = get_redis_client()
    if client is None:
        return True

    try:
        res = await client.eval(RELEASE_LOCK_LUA, 1, lock_key, token)
        return bool(res == 1)
    except Exception as exc:
        logger.warning("Failed to safely release distributed lock '%s': %s", lock_key, exc)
        return False
