"""API routes package."""

from core_ai.api.routes.chat import router as chat_router
from core_ai.api.routes.documents import router as documents_router
from core_ai.api.routes.health import router as health_router

__all__ = ["chat_router", "documents_router", "health_router"]
