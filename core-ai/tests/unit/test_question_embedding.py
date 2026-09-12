from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from core_ai.api.routes.questions import process_question_embeddings


@pytest.mark.asyncio
async def test_question_is_approved_only_after_embedding_is_saved() -> None:
    row = SimpleNamespace(id=7, question="Điều kiện đăng ký học phần là gì?")
    repo = SimpleNamespace(
        get_questions_for_embedding=AsyncMock(return_value=[row]),
        save_embedding_and_approve=AsyncMock(return_value=True),
    )
    embedder = SimpleNamespace(embed_documents=AsyncMock(return_value=[[0.1, 0.2]]))

    result = await process_question_embeddings([7], "vnua", repo, embedder)

    assert result == {"embedded": [7], "failed": []}
    repo.save_embedding_and_approve.assert_awaited_once_with(
        7, row.question, [0.1, 0.2], "vnua"
    )
