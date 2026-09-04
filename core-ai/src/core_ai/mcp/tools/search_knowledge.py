"""Public knowledge search backed by tenant-isolated PostgreSQL documents."""

from typing import Any, Dict, Optional

from pydantic import BaseModel, Field

from core_ai.contracts.errors import ToolExecutionError
from core_ai.contracts.mcp import ToolDefinition, ToolScope
from core_ai.data.repositories.document_repo import DocumentRepository


class SearchKnowledgeInput(BaseModel):
    query: str = Field(..., min_length=2, max_length=1000)
    top_k: int = Field(default=5, ge=1, le=10)
    topic: Optional[str] = Field(default=None, max_length=100)


TOOL_DEFINITION = ToolDefinition(
    name="search_knowledge",
    description="Tìm trong kho tài liệu đã được nhập và xác minh của tenant.",
    scope=ToolScope.PUBLIC,
    input_schema={
        "type": "object",
        "properties": {
            "query": {"type": "string", "minLength": 2, "maxLength": 1000},
            "top_k": {"type": "integer", "minimum": 1, "maximum": 10},
            "topic": {"type": "string", "maxLength": 100},
        },
        "required": ["query"],
        "additionalProperties": False,
    },
    output_schema={"type": "object"},
    timeout_seconds=3.0,
)


async def execute_search_knowledge(arguments: Dict[str, Any]) -> Dict[str, Any]:
    request_data = SearchKnowledgeInput(**arguments)
    tenant_id = str(arguments.get("_tenant_id", ""))
    if not tenant_id:
        raise ToolExecutionError("Thiếu tenant_id đã xác thực")
    query = " ".join(filter(None, [request_data.topic, request_data.query]))
    chunks = await DocumentRepository(settings=arguments.get("_settings")).search_chunks_by_bm25(
        query_text=query,
        top_k=request_data.top_k,
        tenant_id=tenant_id,
    )
    return {
        "query": request_data.query,
        "total_found": len(chunks),
        "results": [
            {
                "document_id": chunk.document_id,
                "chunk_id": chunk.id,
                "title": chunk.document_title or "Tài liệu",
                "page": chunk.page,
                "chunk_index": chunk.chunk_index,
                "snippet": chunk.content,
                "score": chunk.fts_score or 0.0,
            }
            for chunk in chunks
        ],
    }
