"""Core AI API package."""

from core_ai.api.routes import chat_router, documents_router, health_router

__all__ = ["chat_router", "documents_router", "health_router"]
