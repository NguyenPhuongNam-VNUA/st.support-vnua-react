"""Official MCP SDK Streamable HTTP server for the five core tools."""

from typing import Any, Dict, Optional

from mcp.server.mcpserver import Context, MCPServer

from core_ai.config import Settings, get_settings
from core_ai.contracts.mcp import ToolRequest
from core_ai.dependencies import get_component
from core_ai.mcp.gateway import get_mcp_gateway

server = MCPServer(
    "st-care-core-ai",
    description="Tenant-safe ST-Care tools",
    version="0.1.0",
)


def _identity(context: Context[Any, Any]) -> tuple[str, Optional[str], str]:
    headers = {str(k).lower(): str(v) for k, v in (context.headers or {}).items()}
    settings = get_component("settings") or get_settings()
    tenant_id = headers.get("x-tenant-id", settings.default_tenant)
    allowed = settings.allowed_tenants
    if isinstance(allowed, str):
        allowed = [item.strip() for item in allowed.split(",") if item.strip()]
    if tenant_id not in allowed:
        raise ValueError("Tenant không được phép")
    return tenant_id, headers.get("x-user-id"), headers.get("x-request-id", context.request_id)


async def _call(
    name: str,
    arguments: Dict[str, Any],
    context: Context[Any, Any],
    *,
    approved: bool = False,
) -> Dict[str, Any]:
    tenant_id, user_id, request_id = _identity(context)
    result = await get_mcp_gateway().call_tool(
        ToolRequest(
            request_id=request_id,
            tenant_id=tenant_id,
            user_id=user_id,
            tool_name=name,
            arguments=arguments,
            approved=approved,
        )
    )
    return result.data if isinstance(result.data, dict) else {"result": result.data}


@server.tool(name="search_knowledge", structured_output=True)
async def search_knowledge(
    query: str,
    context: Context[Any, Any],
    top_k: int = 5,
    topic: Optional[str] = None,
) -> Dict[str, Any]:
    return await _call(
        "search_knowledge",
        {"query": query, "top_k": top_k, **({"topic": topic} if topic else {})},
        context,
    )


@server.tool(name="get_regulations", structured_output=True)
async def get_regulations(
    context: Context[Any, Any],
    category: str = "all",
    keywords: Optional[str] = None,
    top_k: int = 5,
) -> Dict[str, Any]:
    arguments: Dict[str, Any] = {"category": category, "top_k": top_k}
    if keywords:
        arguments["keywords"] = keywords
    return await _call("get_regulations", arguments, context)


@server.tool(name="lookup_schedule", structured_output=True)
async def lookup_schedule(
    student_id: str,
    context: Context[Any, Any],
    semester: Optional[str] = None,
    week: Optional[int] = None,
    day_of_week: Optional[str] = None,
) -> Dict[str, Any]:
    arguments = {
        key: value
        for key, value in {
            "student_id": student_id,
            "semester": semester,
            "week": week,
            "day_of_week": day_of_week,
        }.items()
        if value is not None
    }
    return await _call("lookup_schedule", arguments, context)


@server.tool(name="check_tuition", structured_output=True)
async def check_tuition(
    student_id: str,
    context: Context[Any, Any],
    semester: Optional[str] = None,
) -> Dict[str, Any]:
    arguments = {"student_id": student_id}
    if semester:
        arguments["semester"] = semester
    return await _call("check_tuition", arguments, context)


@server.tool(name="create_support_case", structured_output=True)
async def create_support_case(
    student_id: str,
    category: str,
    subject: str,
    details: str,
    approved: bool,
    context: Context[Any, Any],
    student_name: Optional[str] = None,
    email: Optional[str] = None,
    phone: Optional[str] = None,
    priority: str = "normal",
    conversation_id: Optional[str] = None,
) -> Dict[str, Any]:
    arguments = {
        key: value
        for key, value in {
            "student_id": student_id,
            "student_name": student_name,
            "category": category,
            "subject": subject,
            "details": details,
            "email": email,
            "phone": phone,
            "priority": priority,
            "conversation_id": conversation_id,
        }.items()
        if value is not None
    }
    return await _call("create_support_case", arguments, context, approved=approved)


def get_mcp_server() -> MCPServer[Any]:
    return server


def get_mcp_asgi_app(settings: Optional[Settings] = None):
    runtime_settings = settings or get_component("settings") or get_settings()
    return server.streamable_http_app(
        streamable_http_path="/mcp",
        json_response=False,
        stateless_http=False,
        max_request_body_size=runtime_settings.max_request_body_bytes,
        host=runtime_settings.core_ai_host,
    )
