"""MCP Tool: create_support_case.

Human-in-the-Loop (HITL) support ticket escalation tool for ST-Care VNUA.
Restricted to ToolScope.ESCALATION. Creates official support requests routed
to appropriate university departments (Ban Quản lý Đào tạo, Ban CTSV, Ban Tài chính).
"""

from datetime import datetime, timezone
import logging
from typing import Any, Dict, List, Optional, Union
import uuid
from pydantic import BaseModel, Field

from core_ai.contracts.mcp import ToolDefinition, ToolScope

logger = logging.getLogger("core_ai.mcp.tools.create_support_case")


class CreateSupportCaseInput(BaseModel):
    """Input payload for support case creation."""
    student_id: str = Field(
        ...,
        description="Mã số sinh viên cần hỗ trợ",
        min_length=4,
    )
    student_name: str = Field(
        ...,
        description="Họ và tên đầy đủ của sinh viên",
        min_length=2,
    )
    category: str = Field(
        ...,
        description="Lĩnh vực hỗ trợ: 'dao_tao', 'hoc_phi', 'ky_tuc_xa', 'hoc_bong', 'khac'",
    )
    subject: str = Field(
        ...,
        description="Tiêu đề yêu cầu hỗ trợ",
        min_length=5,
    )
    details: str = Field(
        ...,
        description="Nội dung chi tiết yêu cầu hỗ trợ hoặc tình huống sinh viên gặp phải",
        min_length=10,
    )
    email: Optional[str] = Field(
        default=None,
        description="Email liên hệ của sinh viên",
    )
    phone: Optional[str] = Field(
        default=None,
        description="Số điện thoại liên hệ",
    )
    priority: str = Field(
        default="normal",
        description="Mức độ ưu tiên: 'low', 'normal', 'high', 'urgent'",
    )
    conversation_id: Optional[Union[str, int]] = Field(
        default=None,
        description="ID phiên hội thoại liên quan để cán bộ kiểm tra ngữ cảnh",
    )


DEPARTMENT_ROUTING: Dict[str, Dict[str, Any]] = {
    "dao_tao": {
        "name": "Ban Quản lý Đào tạo",
        "location": "Phòng 104 - Nhà Trung tâm",
        "email": "daotao@vnua.edu.vn",
        "hotline": "024.6261.7556",
        "sla_hours": 24,
    },
    "hoc_phi": {
        "name": "Ban Tài chính và Kế toán",
        "location": "Phòng 108 - Nhà Trung tâm",
        "email": "taichinh@vnua.edu.vn",
        "hotline": "024.6261.7588",
        "sla_hours": 24,
    },
    "ky_tuc_xa": {
        "name": "Ban Quản lý Ký túc xá",
        "location": "Tầng 1 Nhà B3 Ký túc xá sinh viên",
        "email": "ktx@vnua.edu.vn",
        "hotline": "024.6261.7590",
        "sla_hours": 48,
    },
    "hoc_bong": {
        "name": "Ban Công tác Chính trị và Công tác Sinh viên (CTSV)",
        "location": "Phòng 101 - Nhà Trung tâm",
        "email": "ctsv@vnua.edu.vn",
        "hotline": "024.6261.7522",
        "sla_hours": 48,
    },
    "khac": {
        "name": "Bộ phận Tiếp nhận và Hỗ trợ Một cửa VNUA",
        "location": "Sảnh Tầng 1 - Nhà Trung tâm",
        "email": "hotro_sinhvien@vnua.edu.vn",
        "hotline": "024.6261.7500",
        "sla_hours": 48,
    },
}

# In-memory store of escalated tickets for auditability and mock inspection
CREATED_SUPPORT_CASES: List[Dict[str, Any]] = []

TOOL_DEFINITION = ToolDefinition(
    name="create_support_case",
    description=(
        "Tạo phiếu yêu cầu hỗ trợ (ticket/case) chuyển tiếp cho cán bộ ban chuyên môn VNUA "
        "(Ban Quản lý Đào tạo, Ban CTSV, Ban Tài chính) khi AI không thể giải quyết "
        "hoặc sinh viên cần hỗ trợ thủ tục hành chính trực tiếp."
    ),
    scope=ToolScope.ESCALATION,
    input_schema={
        "type": "object",
        "properties": {
            "student_id": {"type": "string", "description": "Mã sinh viên"},
            "student_name": {"type": "string", "description": "Họ và tên sinh viên"},
            "category": {
                "type": "string",
                "description": "Lĩnh vực: 'dao_tao', 'hoc_phi', 'ky_tuc_xa', 'hoc_bong', 'khac'",
            },
            "subject": {"type": "string", "description": "Tiêu đề yêu cầu"},
            "details": {"type": "string", "description": "Nội dung chi tiết"},
            "email": {"type": "string", "description": "Email liên hệ"},
            "phone": {"type": "string", "description": "Số điện thoại"},
            "priority": {
                "type": "string",
                "description": "Mức ưu tiên: 'low', 'normal', 'high', 'urgent'",
                "default": "normal",
            },
            "conversation_id": {"type": ["string", "integer"], "description": "Mã hội thoại"},
        },
        "required": ["student_id", "student_name", "category", "subject", "details"],
    },
    output_schema={
        "type": "object",
        "properties": {
            "ticket_id": {"type": "string"},
            "status": {"type": "string"},
            "assigned_department": {"type": "string"},
            "sla_response_hours": {"type": "integer"},
            "contact_email": {"type": "string"},
            "created_at": {"type": "string"},
            "instructions_vi": {"type": "string"},
        },
    },
    timeout_seconds=3.0,
    requires_approval=True,
)


async def execute_create_support_case(arguments: Dict[str, Any]) -> Dict[str, Any]:
    """Generates an official HITL escalation ticket and routes to university department."""
    input_model = CreateSupportCaseInput(**arguments)
    cat_key = input_model.category.lower().strip()
    dept = DEPARTMENT_ROUTING.get(cat_key, DEPARTMENT_ROUTING["khac"])

    now_utc = datetime.now(timezone.utc)
    date_str = now_utc.strftime("%Y%m%d")
    short_uuid = uuid.uuid4().hex[:6].upper()
    ticket_id = f"CASE-VNUA-{date_str}-{short_uuid}"

    sla_hours = dept["sla_hours"]
    if input_model.priority in ("urgent", "high"):
        sla_hours = max(12, sla_hours // 2)

    case_record = {
        "ticket_id": ticket_id,
        "student_id": input_model.student_id,
        "student_name": input_model.student_name,
        "email": input_model.email or f"{input_model.student_id}@sv.vnua.edu.vn",
        "phone": input_model.phone,
        "category": cat_key,
        "subject": input_model.subject,
        "details": input_model.details,
        "priority": input_model.priority,
        "conversation_id": input_model.conversation_id,
        "assigned_department": dept["name"],
        "department_location": dept["location"],
        "department_email": dept["email"],
        "department_hotline": dept["hotline"],
        "status": "QUEUED_FOR_DISPATCH",
        "sla_response_hours": sla_hours,
        "created_at": now_utc.isoformat(),
    }

    # Store for auditability
    CREATED_SUPPORT_CASES.append(case_record)

    logger.info(
        "Support case created ticket_id='%s' for student='%s' department='%s' priority='%s'",
        ticket_id,
        input_model.student_id,
        dept["name"],
        input_model.priority,
    )

    return {
        "ticket_id": ticket_id,
        "status": "QUEUED_FOR_DISPATCH",
        "assigned_department": dept["name"],
        "department_location": dept["location"],
        "contact_email": dept["email"],
        "contact_hotline": dept["hotline"],
        "sla_response_hours": sla_hours,
        "created_at": now_utc.isoformat(),
        "instructions_vi": (
            f"Yêu cầu hỗ trợ mã {ticket_id} đã được gửi thành công tới {dept['name']}. "
            f"Cán bộ chuyên môn sẽ phản hồi qua email của bạn trong vòng {sla_hours} giờ làm việc. "
            f"Trong trường hợp khẩn cấp, vui lòng đến trực tiếp {dept['location']} "
            f"hoặc gọi hotline {dept['hotline']} để được giải quyết nhanh nhất."
        ),
    }
