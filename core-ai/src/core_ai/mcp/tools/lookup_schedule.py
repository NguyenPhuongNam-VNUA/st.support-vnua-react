"""Authenticated schedule lookup backed by the authoritative business API."""

from typing import Any, Dict, Optional

from pydantic import BaseModel, Field

from core_ai.contracts.errors import ToolExecutionError
from core_ai.contracts.mcp import ToolDefinition, ToolScope
from core_ai.mcp.tools.business_api import call_business_api


class LookupScheduleInput(BaseModel):
    student_id: str = Field(..., min_length=1)
    semester: Optional[str] = None
    week: Optional[int] = Field(default=None, ge=1, le=25)
    day_of_week: Optional[str] = None


TOOL_DEFINITION = ToolDefinition(
    name="lookup_schedule",
    description="Tra cứu thời khóa biểu của chính sinh viên đã xác thực.",
    scope=ToolScope.AUTHENTICATED,
    input_schema={
        "type": "object",
        "properties": {
            "student_id": {"type": "string"},
            "semester": {"type": "string"},
            "week": {"type": "integer", "minimum": 1, "maximum": 25},
            "day_of_week": {"type": "string"},
        },
        "required": ["student_id"],
        "additionalProperties": False,
    },
    output_schema={"type": "object"},
    timeout_seconds=3.0,
)


async def execute_lookup_schedule(arguments: Dict[str, Any]) -> Dict[str, Any]:
    request_data = LookupScheduleInput(**arguments)
    tenant_id = str(arguments.get("_tenant_id", ""))
    trusted_user_id = str(arguments.get("_user_id", ""))
    if not tenant_id or not trusted_user_id:
        raise ToolExecutionError("Thiếu danh tính đã xác thực để tra cứu thời khóa biểu")
    return await call_business_api(
        "GET",
        f"/internal/v1/students/{trusted_user_id}/schedule",
        tenant_id=tenant_id,
        user_id=trusted_user_id,
        request_id=str(arguments.get("_request_id", "")) or None,
        settings=arguments.get("_settings"),
        query={
            key: value
            for key, value in {
                "semester": request_data.semester,
                "week": request_data.week,
                "day_of_week": request_data.day_of_week,
            }.items()
            if value is not None
        },
    )
