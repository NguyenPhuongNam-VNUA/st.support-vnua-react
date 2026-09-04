"""Document embedding and ingestion routes.

Provides endpoints to trigger background document ingestion from signed URLs:
POST /v1/documents/embed
POST /documents/embed (legacy backwards compatibility)
"""

import uuid
from fastapi import APIRouter, BackgroundTasks, Depends, status

from core_ai.contracts.chat import DocumentEmbedRequest, DocumentEmbedResponse
from core_ai.dependencies import get_component, verify_internal_token

router = APIRouter(tags=["Documents"])


async def handle_document_embed(
    request: DocumentEmbedRequest,
    background_tasks: BackgroundTasks,
) -> DocumentEmbedResponse:
    """Core handler to validate and queue document embedding job."""
    job_id = f"job_embed_{request.document_id}_{uuid.uuid4().hex[:8]}"

    worker = get_component("ingestion_worker")
    if worker is not None and hasattr(worker, "process_document"):
        # Asynchronously dispatch document ingestion
        background_tasks.add_task(
            worker.process_document,
            document_id=request.document_id,
            file_url=request.file_url,
            job_id=job_id,
        )

    return DocumentEmbedResponse(
        document_id=request.document_id,
        status="processing",
        job_id=job_id,
        task_id=job_id,
        message="Tiến trình embedding tài liệu đã được khởi chạy",
    )


@router.post(
    "/v1/documents/embed",
    response_model=DocumentEmbedResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Enqueue document embedding (v1)",
    dependencies=[Depends(verify_internal_token)],
)
async def embed_document_v1(
    request: DocumentEmbedRequest,
    background_tasks: BackgroundTasks,
) -> DocumentEmbedResponse:
    """Trigger background document embedding via v1 endpoint."""
    return await handle_document_embed(request, background_tasks)


@router.post(
    "/documents/embed",
    response_model=DocumentEmbedResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Enqueue document embedding (legacy)",
    dependencies=[Depends(verify_internal_token)],
)
async def embed_document_legacy(
    request: DocumentEmbedRequest,
    background_tasks: BackgroundTasks,
) -> DocumentEmbedResponse:
    """Legacy alias endpoint for Next.js BFF compatibility."""
    return await handle_document_embed(request, background_tasks)
