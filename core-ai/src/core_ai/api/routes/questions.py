"""Internal endpoints for keeping approved FAQ embeddings current."""

import logging
from typing import Any

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field, field_validator

from core_ai.dependencies import (
    get_embedding_service,
    get_question_repository,
    verify_internal_token,
)

logger = logging.getLogger("core_ai.api.routes.questions")
router = APIRouter(tags=["Questions"])


class QuestionEmbeddingPayload(BaseModel):
    question_ids: list[int] = Field(..., min_length=1, max_length=1000)
    background: bool = False

    @field_validator("question_ids")
    @classmethod
    def validate_question_ids(cls, value: list[int]) -> list[int]:
        unique_ids = list(dict.fromkeys(value))
        if any(question_id <= 0 for question_id in unique_ids):
            raise ValueError("question_ids must contain positive integers")
        return unique_ids


async def process_question_embeddings(
    question_ids: list[int],
    tenant_id: str,
    question_repo: Any = None,
    embedding_service: Any = None,
) -> dict[str, list[int]]:
    """Embed FAQ questions sequentially and approve only successfully saved rows."""
    repo = question_repo or get_question_repository()
    embedder = embedding_service or get_embedding_service()
    rows = await repo.get_questions_for_embedding(question_ids, tenant_id)
    rows_by_id = {row.id: row for row in rows}
    embedded: list[int] = []
    failed = [question_id for question_id in question_ids if question_id not in rows_by_id]

    for question_id in question_ids:
        row = rows_by_id.get(question_id)
        if row is None:
            continue
        try:
            vector = (await embedder.embed_documents([row.question]))[0]
            saved = await repo.save_embedding_and_approve(
                row.id,
                row.question,
                vector,
                tenant_id,
            )
            (embedded if saved else failed).append(row.id)
        except Exception as exc:
            logger.error(
                "Question embedding failed for question_id=%d: %s",
                row.id,
                type(exc).__name__,
                exc_info=True,
            )
            failed.append(row.id)

    return {"embedded": embedded, "failed": failed}


@router.post(
    "/questions/embeddings",
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(verify_internal_token)],
)
async def embed_questions(
    payload: QuestionEmbeddingPayload,
    request: Request,
    background_tasks: BackgroundTasks,
) -> dict[str, Any]:
    tenant_id = request.state.context.tenant_id
    if payload.background:
        background_tasks.add_task(process_question_embeddings, payload.question_ids, tenant_id)
        return {"status": "queued", "question_ids": payload.question_ids}

    result = await process_question_embeddings(payload.question_ids, tenant_id)
    if result["failed"]:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Không thể embedding và duyệt câu hỏi",
        )
    return {"status": "completed", **result}
