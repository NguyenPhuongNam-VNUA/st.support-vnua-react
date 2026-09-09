"""Document embedding and ingestion routes.

Provides endpoints to trigger background document ingestion from signed URLs:
- RESTful: POST /api/v1/documents/{document_id}/embeddings (HTTP 202 Accepted + Location header)
- RESTful: GET  /api/v1/documents/{document_id}/chunks (HTTP 200 OK)
- Legacy:  POST /v1/documents/embed
- Legacy:  POST /documents/embed (backwards compatibility with Next.js BFF)
"""

import uuid
from typing import Any, Dict

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, Response, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from core_ai.api.routes.jobs import register_job
from core_ai.contracts.chat import DocumentEmbedRequest, DocumentEmbedResponse
from core_ai.data.repositories.document_repo import DocumentRepository
from core_ai.dependencies import get_component, verify_internal_token

router = APIRouter(tags=["Documents"])


class DocumentEmbeddingCreatePayload(BaseModel):
    """Payload for RESTful document embedding."""
    file_url: str = Field(
        ...,
        min_length=10,
        max_length=4096,
        pattern=r"^https://",
        description="Short-lived signed URL (max 5 mins) to fetch PDF from Supabase Storage",
    )


async def handle_document_embed(
    request: DocumentEmbedRequest,
    background_tasks: BackgroundTasks,
    tenant_id: str,
) -> DocumentEmbedResponse:
    """Core handler to validate and queue document embedding job."""
    doc_id = int(request.document_id)
    job_id = f"job_embed_{doc_id}_{uuid.uuid4().hex[:8]}"

    worker = get_component("ingestion_worker")
    if worker is None or not hasattr(worker, "process_document"):
        raise HTTPException(status_code=503, detail="Ingestion worker is unavailable")

    register_job(job_id=job_id, document_id=doc_id, tenant_id=tenant_id)

    background_tasks.add_task(
        worker.process_document,
        document_id=doc_id,
        file_url=request.file_url,
        job_id=job_id,
        tenant_id=tenant_id,
    )

    return DocumentEmbedResponse(
        document_id=doc_id,
        status="processing",
        job_id=job_id,
        task_id=job_id,
        message="Tiến trình embedding tài liệu đã được khởi chạy",
    )


# ==========================================
# RESTful Endpoints (Resource-Oriented)
# ==========================================


@router.post(
    "/api/v1/documents/{document_id}/embeddings",
    status_code=status.HTTP_202_ACCEPTED,
    summary="Trigger document embedding job (RESTful)",
    dependencies=[Depends(verify_internal_token)],
)
async def create_document_embedding_restful(
    document_id: int,
    payload: DocumentEmbeddingCreatePayload,
    http_request: Request,
    background_tasks: BackgroundTasks,
) -> Response:
    """RESTful endpoint to trigger document embedding job.

    Returns HTTP 202 Accepted with a Location header pointing to the job status resource.
    """
    req = DocumentEmbedRequest(document_id=document_id, file_url=payload.file_url)
    res = await handle_document_embed(
        req, background_tasks, http_request.state.context.tenant_id
    )
    job_location = f"/api/v1/jobs/{res.job_id}"
    return JSONResponse(
        status_code=status.HTTP_202_ACCEPTED,
        content=res.model_dump(),
        headers={"Location": job_location},
    )


@router.get(
    "/api/v1/documents/{document_id}/chunks",
    status_code=status.HTTP_200_OK,
    summary="Get document chunks (RESTful)",
    dependencies=[Depends(verify_internal_token)],
)
async def get_document_chunks_restful(
    document_id: int,
    http_request: Request,
) -> Dict[str, Any]:
    """Retrieve all chunks and vector search tokens for a document."""
    tenant_id = getattr(http_request.state.context, "tenant_id", "vnua")
    doc_repo = get_component("document_repo") or DocumentRepository()
    try:
        chunks = await doc_repo.get_chunks_by_document_id(document_id, tenant_id=tenant_id)
    except Exception:
        chunks = []
    return {
        "document_id": document_id,
        "count": len(chunks),
        "chunks": [chunk.model_dump() if hasattr(chunk, "model_dump") else chunk for chunk in chunks],
    }


# ==========================================
# Legacy / Backward Compatibility Endpoints
# ==========================================


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
