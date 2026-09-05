"""Message repository for PostgreSQL/Supabase chat persistence with client IP tracking and 48-hour TTL auto-deletion."""

from __future__ import annotations

import asyncio
import logging
import time
from typing import Any, Dict, List, Optional

from core_ai.data.postgres import get_db_connection

logger = logging.getLogger("core_ai.data.repositories.message_repo")

DEFAULT_MESSAGE_TTL_HOURS = 48


class MessageRepository:
    """Handles chat message persistence in public.messages by client IP/session and auto-deletes expired records."""

    def __init__(self, ttl_hours: int = DEFAULT_MESSAGE_TTL_HOURS) -> None:
        self.ttl_hours = ttl_hours
        self._last_cleanup_time = 0.0

    async def record_chat_turn(
        self,
        conversation_id: Optional[int | str],
        client_ip: str,
        user_message: str,
        bot_message: str,
        status: str = "answered",
        confidence_score: float = 0.90,
        retrieved_chunk_ids: Optional[List[int]] = None,
        account_id: Optional[int] = None,
        session_id: Optional[str] = None,
    ) -> Optional[int]:
        """Saves a user-bot conversation turn to public.messages linked to client_ip and conversation_id.

        If conversation_id is missing, invalid, or expired (>48h), automatically finds or creates
        an active conversation for this client_ip / session within the 48-hour window.
        """
        valid_conv_id: Optional[int] = None
        str_conv_id = str(conversation_id) if conversation_id else None
        if conversation_id:
            try:
                valid_conv_id = int(str(conversation_id).replace("conv_", ""))
            except ValueError:
                valid_conv_id = None

        raw_session_id = session_id or (str_conv_id if str_conv_id and str_conv_id.startswith("conv_") else None)

        # Map status to allowed enum in check constraint: answered, not_found, auto_generated, out_of_topic
        db_status = "answered"
        if status in ("not_found", "out_of_topic", "auto_generated"):
            db_status = status
        elif status in ("degraded", "fallback", "clarified"):
            db_status = "not_found"

        try:
            async with get_db_connection("vnua") as conn:
                # 1. Check if provided numeric conversation_id is valid and active within 48h
                if valid_conv_id:
                    exists = await conn.fetchval(
                        """
                        SELECT id FROM public.conversations 
                        WHERE id = $1 AND started_at >= NOW() - INTERVAL '48 hours';
                        """,
                        valid_conv_id,
                    )
                    if not exists:
                        valid_conv_id = None

                # 2. Check if active conversation exists for this session_id within 48h
                if valid_conv_id is None and raw_session_id:
                    valid_conv_id = await conn.fetchval(
                        """
                        SELECT id FROM public.conversations 
                        WHERE session_id = $1 AND started_at >= NOW() - INTERVAL '48 hours'
                        ORDER BY started_at DESC LIMIT 1;
                        """,
                        raw_session_id,
                    )

                # 3. Check if active conversation exists for this client_ip within 48h
                if valid_conv_id is None and client_ip and client_ip != "127.0.0.1":
                    valid_conv_id = await conn.fetchval(
                        """
                        SELECT id FROM public.conversations 
                        WHERE client_ip = $1 AND started_at >= NOW() - INTERVAL '48 hours'
                        ORDER BY started_at DESC LIMIT 1;
                        """,
                        client_ip,
                    )

                # 4. Create new conversation if none active
                if valid_conv_id is None:
                    valid_conv_id = await conn.fetchval(
                        """
                        INSERT INTO public.conversations (account_id, client_ip, session_id, started_at)
                        VALUES ($1, $2, $3, NOW())
                        RETURNING id;
                        """,
                        account_id,
                        client_ip,
                        raw_session_id,
                    )

                # 5. Insert User Message with client_ip
                await conn.execute(
                    """
                    INSERT INTO public.messages (conversation_id, client_ip, sender, content, status, created_at)
                    VALUES ($1, $2, 'user', $3, 'answered', NOW());
                    """,
                    valid_conv_id,
                    client_ip,
                    user_message,
                )

                # 6. Insert Bot Message with client_ip, status, confidence, citations
                await conn.execute(
                    """
                    INSERT INTO public.messages (
                        conversation_id, client_ip, sender, content, status, confidence_score, retrieved_chunk_ids, created_at
                    )
                    VALUES ($1, $2, 'bot', $3, $4, $5, $6, NOW());
                    """,
                    valid_conv_id,
                    client_ip,
                    bot_message,
                    db_status,
                    confidence_score,
                    retrieved_chunk_ids or [],
                )

            # Trigger non-blocking opportunistic cleanup if > 15 minutes since last cleanup
            now = time.monotonic()
            if now - self._last_cleanup_time > 900:
                self._last_cleanup_time = now
                asyncio.create_task(self.cleanup_expired_messages())

            return valid_conv_id

        except Exception as exc:
            # Persistence failure must NEVER fail the user request
            logger.warning("Failed to persist chat messages to public.messages: %s", exc)
            return valid_conv_id

    async def get_recent_history_by_ip(self, client_ip: str, limit: int = 6) -> List[Dict[str, str]]:
        """Retrieves recent conversation turns for this client_ip within the 48-hour window."""
        if not client_ip:
            return []
        try:
            async with get_db_connection("vnua") as conn:
                rows = await conn.fetch(
                    f"""
                    SELECT sender, content
                    FROM public.messages
                    WHERE client_ip = $1
                      AND created_at >= NOW() - INTERVAL '{self.ttl_hours} hours'
                    ORDER BY id DESC
                    LIMIT $2;
                    """,
                    client_ip,
                    limit,
                )
                history = []
                for row in reversed(rows):
                    role = "assistant" if row["sender"] == "bot" else "user"
                    history.append({"role": role, "content": row["content"]})
                return history
        except Exception as exc:
            logger.warning("Failed to fetch history from DB for IP %s: %s", client_ip, exc)
            return []

    async def cleanup_expired_messages(self) -> int:
        """Deletes messages older than the configured TTL (default 48 hours).

        Also cleans up empty conversations whose messages have expired.
        """
        try:
            async with get_db_connection("vnua") as conn:
                # 1. Delete messages older than 48 hours
                del_result = await conn.execute(
                    f"DELETE FROM public.messages WHERE created_at < NOW() - INTERVAL '{self.ttl_hours} hours';"
                )
                deleted_count = 0
                if del_result and "DELETE" in del_result:
                    try:
                        deleted_count = int(del_result.split()[-1])
                    except (IndexError, ValueError):
                        deleted_count = 0

                # 2. Delete conversations older than 48h that have no messages left
                await conn.execute(
                    f"""
                    DELETE FROM public.conversations
                    WHERE started_at < NOW() - INTERVAL '{self.ttl_hours} hours'
                      AND NOT EXISTS (
                          SELECT 1 FROM public.messages WHERE conversation_id = conversations.id
                      );
                    """
                )

                if deleted_count > 0:
                    logger.info("48-Hour TTL Cleanup: Purged %d expired messages from DB", deleted_count)
                return deleted_count
        except Exception as exc:
            logger.warning("48-Hour TTL message cleanup encountered an error: %s", exc)
            return 0


_global_message_repo: Optional[MessageRepository] = None


def get_message_repository() -> MessageRepository:
    """Returns singleton MessageRepository instance."""
    global _global_message_repo
    if _global_message_repo is None:
        _global_message_repo = MessageRepository()
    return _global_message_repo
