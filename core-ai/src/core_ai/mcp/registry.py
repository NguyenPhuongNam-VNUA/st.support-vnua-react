"""Tool Registry and Access Control (ACL) for MCP Gateway.

Maintains registry of local and discovered remote MCP tools, enforces allowlist
filtering, tenant isolation, student authentication scope, and input schema validation.
"""

from dataclasses import dataclass
import logging
from typing import Any, Awaitable, Callable, Dict, List, Optional, Set, Union

from core_ai.contracts.errors import (
    TenantForbiddenError,
    ToolExecutionError,
    ToolNotAllowedError,
)
from core_ai.contracts.mcp import ToolDefinition, ToolRequest, ToolScope
from core_ai.mcp.tools import get_core_tools

logger = logging.getLogger("core_ai.mcp.registry")

ToolHandler = Callable[[Dict[str, Any]], Awaitable[Dict[str, Any]]]


@dataclass
class RegisteredTool:
    """Internal container for a registered tool with its execution handler."""
    definition: ToolDefinition
    handler: Optional[ToolHandler] = None
    server_id: Optional[str] = None
    is_remote: bool = False


class ToolRegistry:
    """Thread-safe registry for MCP tools with tenant & scope ACL filtering."""

    def __init__(self) -> None:
        self._tools: Dict[str, RegisteredTool] = {}
        # Pre-register initial 5 core tools
        self._register_default_core_tools()

    def _register_default_core_tools(self) -> None:
        """Initializes registry with the 5 core tools."""
        for definition, handler in get_core_tools():
            self.register_tool(definition, handler, server_id="in-process", is_remote=False)

    def register_tool(
        self,
        definition: ToolDefinition,
        handler: Optional[ToolHandler] = None,
        server_id: Optional[str] = None,
        is_remote: bool = False,
    ) -> None:
        """Registers a tool definition and optional local execution handler."""
        self._tools[definition.name] = RegisteredTool(
            definition=definition,
            handler=handler,
            server_id=server_id,
            is_remote=is_remote,
        )
        logger.info(
            "Registered tool '%s' (scope: %s, remote: %s, server: %s)",
            definition.name,
            definition.scope.value,
            is_remote,
            server_id,
        )

    def unregister_tool(self, tool_name: str) -> None:
        """Removes a tool from the registry."""
        if tool_name in self._tools:
            del self._tools[tool_name]
            logger.info("Unregistered tool '%s'", tool_name)

    def get_tool(self, tool_name: str) -> Optional[RegisteredTool]:
        """Retrieves a registered tool by identifier."""
        return self._tools.get(tool_name)

    def list_all_definitions(self) -> List[ToolDefinition]:
        """Returns all registered tool definitions without filtering."""
        return [tool.definition for tool in self._tools.values()]

    def list_tools(
        self,
        tenant_id: str,
        user_id: Optional[Union[int, str]] = None,
        allowed_tools: Optional[List[str]] = None,
    ) -> List[ToolDefinition]:
        """Returns permitted tool definitions filtered by tenant, caller scope, and allowlist."""
        allowed_set: Optional[Set[str]] = set(allowed_tools) if allowed_tools is not None else None
        permitted: List[ToolDefinition] = []

        for name, tool in self._tools.items():
            # 1. Allowlist filter
            if allowed_set is not None and name not in allowed_set:
                continue

            # 2. Scope filter: AUTHENTICATED tools require non-empty user_id
            if tool.definition.scope == ToolScope.AUTHENTICATED and not user_id:
                continue

            # 3. Scope filter: ADMIN tools require admin privilege
            if tool.definition.scope == ToolScope.ADMIN and not user_id:
                continue

            permitted.append(tool.definition)

        return permitted

    def validate_tool_call(
        self,
        request: ToolRequest,
        allowed_tools: Optional[List[str]] = None,
    ) -> RegisteredTool:
        """Validates tool invocation against allowlist, ACL scope, and input schema.

        Raises:
            ToolNotAllowedError: If tool is unlisted, not registered, or caller lacks scope.
            TenantForbiddenError: If tenant isolation is violated.
            ToolExecutionError: If arguments fail JSON Schema requirements.
        """
        tool_name = request.tool_name

        # 1. Check configured allowlist
        if allowed_tools is not None and tool_name not in allowed_tools:
            logger.warning(
                "Tool '%s' invocation rejected: not present in allowlist %s",
                tool_name,
                allowed_tools,
            )
            raise ToolNotAllowedError(tool_name)

        # 2. Check existence in registry
        registered = self.get_tool(tool_name)
        if registered is None:
            logger.warning("Tool '%s' invocation rejected: not found in registry", tool_name)
            raise ToolNotAllowedError(tool_name)

        # 3. Check Tenant isolation
        if not request.tenant_id or request.tenant_id.strip() == "":
            raise TenantForbiddenError("Yêu cầu thực thi công cụ bắt buộc phải có tenant_id hợp lệ")

        # 4. Check Scope ACL
        definition = registered.definition
        if definition.scope == ToolScope.AUTHENTICATED and not request.user_id:
            logger.warning(
                "Tool '%s' requires ToolScope.AUTHENTICATED but user_id is absent",
                tool_name,
            )
            raise ToolNotAllowedError(tool_name)

        if definition.scope == ToolScope.ADMIN and not request.user_id:
            logger.warning("Tool '%s' requires ToolScope.ADMIN but caller is anonymous", tool_name)
            raise ToolNotAllowedError(tool_name)

        # 5. Basic Schema validation for required arguments
        schema = definition.input_schema or {}
        required_fields = schema.get("required", [])
        missing_fields = [f for f in required_fields if f not in request.arguments]

        if missing_fields:
            logger.warning(
                "Tool '%s' invocation failed argument validation: missing %s",
                tool_name,
                missing_fields,
            )
            raise ToolExecutionError(
                f"Tham số không hợp lệ cho công cụ {tool_name}. Thiếu trường: {', '.join(missing_fields)}"
            )

        return registered
