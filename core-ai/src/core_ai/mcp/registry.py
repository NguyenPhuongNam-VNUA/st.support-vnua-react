"""MCP tool registry with allowlist, ACL and full JSON Schema validation."""

from dataclasses import dataclass
from typing import Any, Awaitable, Callable, Dict, List, Optional, Set, Union

from jsonschema import ValidationError, validate

from core_ai.contracts.errors import TenantForbiddenError, ToolExecutionError, ToolNotAllowedError
from core_ai.contracts.mcp import ToolDefinition, ToolRequest, ToolScope
from core_ai.mcp.tools import get_core_tools

ToolHandler = Callable[[Dict[str, Any]], Awaitable[Dict[str, Any]]]


@dataclass
class RegisteredTool:
    definition: ToolDefinition
    handler: Optional[ToolHandler] = None
    server_id: Optional[str] = None
    is_remote: bool = False


class ToolRegistry:
    def __init__(self) -> None:
        self._tools: Dict[str, RegisteredTool] = {}
        for definition, handler in get_core_tools():
            self.register_tool(definition, handler, server_id="in-process")

    def register_tool(
        self,
        definition: ToolDefinition,
        handler: Optional[ToolHandler] = None,
        server_id: Optional[str] = None,
        is_remote: bool = False,
    ) -> None:
        self._tools[definition.name] = RegisteredTool(
            definition=definition,
            handler=handler,
            server_id=server_id,
            is_remote=is_remote,
        )

    def unregister_tool(self, tool_name: str) -> None:
        self._tools.pop(tool_name, None)

    def get_tool(self, tool_name: str) -> Optional[RegisteredTool]:
        return self._tools.get(tool_name)

    def list_all_definitions(self) -> List[ToolDefinition]:
        return [tool.definition for tool in self._tools.values()]

    def list_tools(
        self,
        tenant_id: str,
        user_id: Optional[Union[int, str]] = None,
        allowed_tools: Optional[List[str]] = None,
    ) -> List[ToolDefinition]:
        if not tenant_id:
            return []
        allow: Optional[Set[str]] = set(allowed_tools) if allowed_tools is not None else None
        result: List[ToolDefinition] = []
        for name, tool in self._tools.items():
            definition = tool.definition
            if allow is not None and name not in allow:
                continue
            if definition.scope != ToolScope.PUBLIC and not user_id:
                continue
            result.append(definition)
        return result

    def validate_tool_call(
        self,
        request: ToolRequest,
        allowed_tools: Optional[List[str]] = None,
    ) -> RegisteredTool:
        if not request.tenant_id.strip():
            raise TenantForbiddenError("Yêu cầu công cụ phải có tenant_id hợp lệ")
        if allowed_tools is not None and request.tool_name not in allowed_tools:
            raise ToolNotAllowedError(request.tool_name)

        registered = self.get_tool(request.tool_name)
        if registered is None:
            raise ToolNotAllowedError(request.tool_name)
        definition = registered.definition
        if definition.scope != ToolScope.PUBLIC and not request.user_id:
            raise ToolNotAllowedError(request.tool_name)
        if definition.requires_approval and not request.approved:
            raise ToolNotAllowedError(request.tool_name)

        try:
            validate(instance=request.arguments, schema=definition.input_schema or {})
        except ValidationError as exc:
            raise ToolExecutionError(
                f"Tham số không hợp lệ cho công cụ {request.tool_name}"
            ) from exc
        return registered

    @staticmethod
    def validate_tool_output(registered: RegisteredTool, output: Dict[str, Any]) -> None:
        schema = registered.definition.output_schema
        if not schema:
            return
        try:
            validate(instance=output, schema=schema)
        except ValidationError as exc:
            raise ToolExecutionError(
                f"Kết quả không hợp lệ từ công cụ {registered.definition.name}"
            ) from exc
