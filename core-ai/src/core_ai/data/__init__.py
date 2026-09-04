"""Data layer package for ST-Care Core AI."""

from core_ai.data.postgres import (
    check_db_health,
    close_db_pool,
    get_db_connection,
    get_db_pool,
    init_db_pool,
)
from core_ai.data.redis import (
    acquire_lock,
    check_redis_health,
    close_redis_client,
    get_redis_client,
    init_redis_client,
    is_redis_degraded,
    release_lock,
)
from core_ai.data.repositories import (
    ChunkCreate,
    ChunkRecord,
    DocumentRecord,
    DocumentRepository,
    QuestionRecord,
    QuestionRepository,
)

__all__ = [
    "init_db_pool",
    "close_db_pool",
    "get_db_pool",
    "get_db_connection",
    "check_db_health",
    "init_redis_client",
    "close_redis_client",
    "get_redis_client",
    "check_redis_health",
    "is_redis_degraded",
    "acquire_lock",
    "release_lock",
    "DocumentRepository",
    "QuestionRepository",
    "DocumentRecord",
    "ChunkRecord",
    "ChunkCreate",
    "QuestionRecord",
]
