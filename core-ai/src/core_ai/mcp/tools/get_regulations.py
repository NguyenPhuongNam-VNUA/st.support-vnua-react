"""Regulation lookup backed by ingested, tenant-isolated documents."""

from typing import Any, Dict, Optional

from pydantic import BaseModel, Field

from core_ai.mcp.tools.search_knowledge import execute_search_knowledge
from core_ai.contracts.mcp import ToolDefinition, ToolScope


class GetRegulationsInput(BaseModel):
    category: str = Field(default="all", max_length=100)
    keywords: Optional[str] = Field(default=None, max_length=1000)
    top_k: int = Field(default=5, ge=1, le=10)


TOOL_DEFINITION = ToolDefinition(
    name="get_regulations",
    description="Tra cứu quy chế từ kho văn bản đã nhập và xác minh.",
    scope=ToolScope.PUBLIC,
    input_schema={
        "type": "object",
        "properties": {
            "category": {"type": "string", "maxLength": 100},
            "keywords": {"type": "string", "maxLength": 1000},
            "top_k": {"type": "integer", "minimum": 1, "maximum": 10},
        },
        "additionalProperties": False,
    },
    output_schema={"type": "object"},
    timeout_seconds=3.0,
)


async def execute_get_regulations(arguments: Dict[str, Any]) -> Dict[str, Any]:
    request_data = GetRegulationsInput(**arguments)
    category = "" if request_data.category in ("", "all") else request_data.category
    query = " ".join(filter(None, ["quy chế quy định", category, request_data.keywords]))
    result = await execute_search_knowledge(
        {
            "query": query,
            "top_k": request_data.top_k,
            "_tenant_id": arguments.get("_tenant_id"),
            "_user_id": arguments.get("_user_id"),
            "_settings": arguments.get("_settings"),
        }
    )
    return {
        "category_filter": request_data.category,
        "keywords": request_data.keywords,
        "total_matches": result["total_found"],
        "regulations": result["results"],
    }
