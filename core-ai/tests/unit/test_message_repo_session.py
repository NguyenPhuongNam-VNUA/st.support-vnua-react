from contextlib import asynccontextmanager
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from core_ai.data.repositories.message_repo import MessageRepository


@pytest.mark.asyncio
async def test_new_session_is_not_merged_into_same_ip_conversation() -> None:
    conn = MagicMock()
    # session lookup misses, then INSERT ... RETURNING id gives the new conversation.
    conn.fetchval = AsyncMock(side_effect=[None, 99])
    conn.execute = AsyncMock()

    @asynccontextmanager
    async def fake_connection(tenant_id=None):
        yield conn

    with patch("core_ai.data.repositories.message_repo.get_db_connection", fake_connection):
        await MessageRepository().record_chat_turn(
            conversation_id="c0d15d9f-8514-4a8b-8978-a193ae729d42",
            client_ip="172.18.0.1",
            user_message="Học phí?",
            bot_message="Trả lời",
            session_id="c0d15d9f-8514-4a8b-8978-a193ae729d42",
        )

    queries = [call.args[0] for call in conn.fetchval.call_args_list]
    assert not any("client_ip = $1" in q for q in queries)
    assert "INSERT INTO public.conversations" in queries[-1]
    assert conn.execute.call_args_list[0].args[1] == 99
