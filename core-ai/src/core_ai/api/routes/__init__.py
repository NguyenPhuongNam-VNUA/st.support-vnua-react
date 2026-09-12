"""API routes package."""

from core_ai.api.routes.chat import router as chat_router
from core_ai.api.routes.conversations import router as conversations_router
from core_ai.api.routes.documents import router as documents_router
from core_ai.api.routes.health import router as health_router
from core_ai.api.routes.jobs import router as jobs_router
from core_ai.api.routes.questions import router as questions_router

__all__ = [
    "chat_router",
    "conversations_router",
    "documents_router",
    "health_router",
    "jobs_router",
    "questions_router",
]
