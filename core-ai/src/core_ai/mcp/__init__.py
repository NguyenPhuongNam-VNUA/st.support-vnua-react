"""MCP Gateway module for ST-Care VNUA Core AI microservice.

Provides model-independent MCP tool integration, supporting streamable-http
and stdio transports, tool registry, allowlist filtering, tenant/user ACL enforcement,
3-state Circuit Breaker, and 5 core tools.
"""

from core_ai.mcp.circuit_breaker import ToolCircuitBreaker
from core_ai.mcp.client_manager import MCPClientManager
from core_ai.mcp.gateway import MCPGatewayImpl, get_mcp_gateway
from core_ai.mcp.registry import RegisteredTool, ToolRegistry
from core_ai.mcp.server import MCPServer, create_mcp_server
from core_ai.mcp.tools import (
    CHECK_TUITION_DEF,
    CORE_TOOL_DEFINITIONS,
    CORE_TOOL_HANDLERS,
    CREATE_SUPPORT_CASE_DEF,
    GET_REGULATIONS_DEF,
    LOOKUP_SCHEDULE_DEF,
    SEARCH_KNOWLEDGE_DEF,
    get_core_tools,
)

__all__ = [
    "MCPGatewayImpl",
    "get_mcp_gateway",
    "ToolCircuitBreaker",
    "MCPClientManager",
    "ToolRegistry",
    "RegisteredTool",
    "MCPServer",
    "create_mcp_server",
    "SEARCH_KNOWLEDGE_DEF",
    "LOOKUP_SCHEDULE_DEF",
    "CHECK_TUITION_DEF",
    "GET_REGULATIONS_DEF",
    "CREATE_SUPPORT_CASE_DEF",
    "CORE_TOOL_DEFINITIONS",
    "CORE_TOOL_HANDLERS",
    "get_core_tools",
]
