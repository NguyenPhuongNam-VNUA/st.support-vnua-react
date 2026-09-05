"""Document embedding and ingestion routes.

Provides endpoints to trigger background document ingestion from signed URLs:
POST /v1/documents/embed
POST /documents/embed (legacy backwards compatibility)
"""

import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status

from core_ai.contracts.chat import DocumentEmbedRequest, DocumentEmbedResponse
from core_ai.dependencies import get_component, verify_internal_token

router = APIRouter(tags=["Documents"])


async def handle_document_embed(
    request: DocumentEmbedRequest,
    background_tasks: BackgroundTasks,
    tenant_id: str,
) -> DocumentEmbedResponse:
    """Core handler to validate and queue document embedding job."""
    job_id = f"job_embed_{request.document_id}_{uuid.uuid4().hex[:8]}"

    worker = get_component("ingestion_worker")
    if worker is None or not hasattr(worker, "process_document"):
        raise HTTPException(status_code=503, detail="Ingestion worker is unavailable")
    background_tasks.add_task(
        worker.process_document,
        document_id=request.document_id,
        file_url=request.file_url,
        job_id=job_id,
        tenant_id=tenant_id,
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
    http_request: Request,
    request: DocumentEmbedRequest,
    background_tasks: BackgroundTasks,
) -> DocumentEmbedResponse:
    """Trigger background document embedding via v1 endpoint."""
    return await handle_document_embed(
        request, background_tasks, http_request.state.context.tenant_id
    )


@router.post(
    "/documents/embed",
    response_model=DocumentEmbedResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Enqueue document embedding (legacy)",
    dependencies=[Depends(verify_internal_token)],
)
async def embed_document_legacy(
    http_request: Request,
    request: DocumentEmbedRequest,
    background_tasks: BackgroundTasks,
) -> DocumentEmbedResponse:
    """Legacy alias endpoint for Next.js BFF compatibility."""
    return await handle_document_embed(
        request, background_tasks, http_request.state.context.tenant_id
    )
