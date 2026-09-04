"""HITL support creation backed by the authoritative business API."""

from typing import Any, Dict, Optional, Union

from pydantic import BaseModel, Field

from core_ai.contracts.errors import ToolExecutionError
from core_ai.contracts.mcp import ToolDefinition, ToolScope
from core_ai.mcp.tools.business_api import call_business_api


class CreateSupportCaseInput(BaseModel):
    student_id: str = Field(..., min_length=1)
    student_name: Optional[str] = None
    category: str = Field(..., min_length=2)
    subject: str = Field(..., min_length=5, max_length=200)
    details: str = Field(..., min_length=10, max_length=4000)
    email: Optional[str] = None
    phone: Optional[str] = None
    priority: str = "normal"
    conversation_id: Optional[Union[str, int]] = None


TOOL_DEFINITION = ToolDefinition(
    name="create_support_case",
    description="Tạo phiếu hỗ trợ thật và chuyển tới cán bộ phụ trách.",
    scope=ToolScope.ESCALATION,
    input_schema={
        "type": "object",
        "properties": {
            "student_id": {"type": "string"},
            "student_name": {"type": "string"},
            "category": {"type": "string"},
            "subject": {"type": "string"},
            "details": {"type": "string"},
            "email": {"type": "string"},
            "phone": {"type": "string"},
            "priority": {"type": "string"},
            "conversation_id": {"type": ["string", "integer"]},
        },
        "required": ["student_id", "category", "subject", "details"],
        "additionalProperties": False,
    },
    output_schema={"type": "object"},
    timeout_seconds=3.0,
    requires_approval=True,
)


async def execute_create_support_case(arguments: Dict[str, Any]) -> Dict[str, Any]:
    request_data = CreateSupportCaseInput(**arguments)
    tenant_id = str(arguments.get("_tenant_id", ""))
    trusted_user_id = str(arguments.get("_user_id", ""))
    if not tenant_id or not trusted_user_id:
        raise ToolExecutionError("Thiếu danh tính đã xác thực để tạo phiếu hỗ trợ")
    payload = request_data.model_dump(exclude={"student_id"}, exclude_none=True)
    payload["student_id"] = trusted_user_id
    return await call_business_api(
        "POST",
        "/internal/v1/support-cases",
        tenant_id=tenant_id,
        user_id=trusted_user_id,
        request_id=str(arguments.get("_request_id", "")) or None,
        settings=arguments.get("_settings"),
        payload=payload,
    )
