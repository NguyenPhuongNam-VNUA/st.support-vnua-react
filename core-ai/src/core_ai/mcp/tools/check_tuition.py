"""Authenticated tuition lookup backed by the authoritative business API."""

from typing import Any, Dict, Optional

from pydantic import BaseModel, Field

from core_ai.contracts.errors import ToolExecutionError
from core_ai.contracts.mcp import ToolDefinition, ToolScope
from core_ai.mcp.tools.business_api import call_business_api


class CheckTuitionInput(BaseModel):
    student_id: str = Field(..., min_length=1)
    semester: Optional[str] = None


TOOL_DEFINITION = ToolDefinition(
    name="check_tuition",
    description="Tra cứu học phí và công nợ của chính sinh viên đã xác thực.",
    scope=ToolScope.AUTHENTICATED,
    input_schema={
        "type": "object",
        "properties": {
            "student_id": {"type": "string"},
            "semester": {"type": "string"},
        },
        "required": ["student_id"],
        "additionalProperties": False,
    },
    output_schema={"type": "object"},
    timeout_seconds=3.0,
)


async def execute_check_tuition(arguments: Dict[str, Any]) -> Dict[str, Any]:
    request_data = CheckTuitionInput(**arguments)
    tenant_id = str(arguments.get("_tenant_id", ""))
    trusted_user_id = str(arguments.get("_user_id", ""))
    if not tenant_id or not trusted_user_id:
        raise ToolExecutionError("Thiếu danh tính đã xác thực để tra cứu học phí")
    query = {"semester": request_data.semester} if request_data.semester else None
    return await call_business_api(
        "GET",
        f"/internal/v1/students/{trusted_user_id}/tuition",
        tenant_id=tenant_id,
        user_id=trusted_user_id,
        request_id=str(arguments.get("_request_id", "")) or None,
        settings=arguments.get("_settings"),
        query=query,
    )
