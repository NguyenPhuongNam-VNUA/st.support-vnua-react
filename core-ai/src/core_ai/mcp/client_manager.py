"""Remote MCP connections implemented with the official Python SDK."""

import json
from contextlib import asynccontextmanager
from typing import Any, Dict, List, Optional

import httpx2
from mcp import Client, StdioServerParameters
from mcp.client.streamable_http import streamable_http_client

from core_ai.contracts.errors import ToolExecutionError
from core_ai.contracts.mcp import ToolDefinition, ToolScope


class MCPClientManager:
    def __init__(self, default_transport: str = "streamable-http") -> None:
        self.default_transport = default_transport
        self._servers: Dict[str, Dict[str, Any]] = {}

    def register_server(
        self,
        server_id: str,
        transport: str = "streamable-http",
        endpoint_or_command: str = "",
        headers: Optional[Dict[str, str]] = None,
        env: Optional[Dict[str, str]] = None,
        args: Optional[List[str]] = None,
    ) -> None:
        if not endpoint_or_command:
            raise ValueError("MCP server target must not be empty")
        self._servers[server_id] = {
            "transport": transport,
            "target": endpoint_or_command,
            "env": env,
            "args": args or [],
            "headers": headers or {},
        }

    def _target(self, server_id: str) -> str | StdioServerParameters:
        config = self._servers.get(server_id)
        if config is None:
            raise ToolExecutionError(f"Máy chủ MCP '{server_id}' chưa được cấu hình")
        transport = config["transport"]
        if transport in ("streamable-http", "http"):
            return str(config["target"])
        if transport == "stdio":
            return StdioServerParameters(
                command=str(config["target"]),
                args=list(config["args"]),
                env=config["env"],
            )
        raise ToolExecutionError(f"MCP transport '{transport}' không được hỗ trợ")

    @asynccontextmanager
    async def _client(
        self,
        server_id: str,
        timeout_seconds: float,
        context_headers: Optional[Dict[str, str]] = None,
    ):
        config = self._servers.get(server_id)
        if config is None:
            raise ToolExecutionError(f"Máy chủ MCP '{server_id}' chưa được cấu hình")
        if config["transport"] in ("streamable-http", "http"):
            headers = {**config["headers"], **(context_headers or {})}
            async with httpx2.AsyncClient(headers=headers) as http_client:
                transport = streamable_http_client(config["target"], http_client=http_client)
                async with Client(
                    transport,
                    read_timeout_seconds=timeout_seconds,
                    raise_exceptions=True,
                ) as client:
                    yield client
            return
        async with Client(
            self._target(server_id),
            read_timeout_seconds=timeout_seconds,
            raise_exceptions=True,
        ) as client:
            yield client

    @staticmethod
    def _result_data(result: Any) -> Dict[str, Any]:
        if getattr(result, "is_error", False):
            raise ToolExecutionError("Máy chủ MCP báo lỗi khi thực thi công cụ")
        structured = getattr(result, "structured_content", None)
        if isinstance(structured, dict):
            return structured
        content = getattr(result, "content", None) or []
        texts = [getattr(item, "text", "") for item in content if getattr(item, "text", None)]
        if len(texts) == 1:
            try:
                parsed = json.loads(texts[0])
                return parsed if isinstance(parsed, dict) else {"result": parsed}
            except json.JSONDecodeError:
                return {"result": texts[0]}
        return {"content": texts}

    async def execute_remote_tool(
        self,
        server_id: str,
        tool_name: str,
        arguments: Dict[str, Any],
        timeout_seconds: float = 3.0,
        context_headers: Optional[Dict[str, str]] = None,
    ) -> Dict[str, Any]:
        try:
            async with self._client(server_id, timeout_seconds, context_headers) as client:
                result = await client.call_tool(
                    tool_name,
                    arguments,
                    read_timeout_seconds=timeout_seconds,
                )
                return self._result_data(result)
        except ToolExecutionError:
            raise
        except Exception as exc:
            raise ToolExecutionError(
                f"Không thể thực thi công cụ MCP '{tool_name}'"
            ) from exc

    async def discover_tools(self, server_id: str) -> List[ToolDefinition]:
        try:
            async with self._client(server_id, 3.0) as client:
                page = await client.list_tools()
                return [
                    ToolDefinition(
                        name=tool.name,
                        description=tool.description or "",
                        scope=ToolScope.PUBLIC,
                        input_schema=tool.input_schema,
                    )
                    for tool in page.tools
                ]
        except Exception as exc:
            raise ToolExecutionError(
                f"Không thể đọc danh sách công cụ từ MCP server '{server_id}'"
            ) from exc

    async def close(self) -> None:
        """Clients are scoped per operation and close their transports automatically."""
