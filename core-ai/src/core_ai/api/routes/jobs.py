"""RESTful Background Jobs API endpoints.

Tracks asynchronous operations (e.g. document ingestion and embedding jobs) according to REST:
- GET /api/v1/jobs/{job_id} (Retrieve job progress, stage, and completion status - 200 OK or 404 Not Found)
"""

from datetime import datetime, timezone
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, status

from core_ai.data.repositories.document_repo import DocumentRepository
from core_ai.dependencies import verify_internal_token

router = APIRouter(prefix="/api/v1/jobs", tags=["Jobs"])

# In-memory registry for recent background jobs
_JOBS_REGISTRY: Dict[str, Dict[str, Any]] = {}


def register_job(job_id: str, document_id: int, tenant_id: str = "vnua") -> Dict[str, Any]:
    """Register a new asynchronous background job."""
    entry = {
        "job_id": job_id,
        "document_id": document_id,
        "tenant_id": tenant_id,
        "status": "processing",
        "stage": "queued",
        "progress": 0,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    _JOBS_REGISTRY[job_id] = entry
    return entry


def update_job_status(job_id: str, status: str, progress: int, stage: str) -> None:
    """Update job progress and stage."""
    if job_id in _JOBS_REGISTRY:
        _JOBS_REGISTRY[job_id]["status"] = status
        _JOBS_REGISTRY[job_id]["progress"] = progress
        _JOBS_REGISTRY[job_id]["stage"] = stage
        _JOBS_REGISTRY[job_id]["updated_at"] = datetime.now(timezone.utc).isoformat()


@router.get(
    "/{job_id}",
    summary="Get background job status (RESTful)",
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(verify_internal_token)],
)
async def get_job_status(job_id: str) -> Dict[str, Any]:
    """Retrieve current status and progress of a background job.

    Checks in-memory job registry and cross-references live PostgreSQL document state.
    """
    job_info = _JOBS_REGISTRY.get(job_id)

    # If job not in memory, parse job_id pattern job_embed_{doc_id}_{suffix}
    doc_id: Optional[int] = None
    if job_info is not None:
        doc_id = job_info.get("document_id")
    elif job_id.startswith("job_embed_"):
        parts = job_id.split("_")
        if len(parts) >= 3:
            try:
                doc_id = int(parts[2])
            except ValueError:
                doc_id = None

    if doc_id is None and job_info is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Tác vụ với mã '{job_id}' không tồn tại hoặc đã hết hạn",
        )

    # Cross-reference live document state in DB
    doc_repo = DocumentRepository()
    doc_record = None
    if doc_id is not None:
        try:
            doc_record = await doc_repo.get_document_by_id(doc_id)
        except Exception:
            pass

    if doc_record is not None:
        stage = doc_record.pipeline_stage or "processing"
        progress = doc_record.progress if doc_record.progress is not None else 0
        overall_status = "ready" if stage == "ready" else "failed" if stage == "failed" else "processing"

        return {
            "job_id": job_id,
            "document_id": doc_id,
            "status": overall_status,
            "stage": stage,
            "progress": progress,
            "resource": f"/api/v1/documents/{doc_id}",
            "created_at": job_info.get("created_at") if job_info else doc_record.created_at.isoformat() if doc_record.created_at else None,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }

    if job_info is not None:
        return job_info

    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=f"Tác vụ với mã '{job_id}' không tồn tại",
    )
