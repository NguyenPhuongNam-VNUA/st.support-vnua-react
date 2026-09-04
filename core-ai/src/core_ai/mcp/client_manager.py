"""MCP Client Manager supporting streamable-http and stdio transports.

Manages connections, transport protocols, and tool invocation sessions
for remote and local MCP servers.
"""

import asyncio
import json
import logging
from typing import Any, Dict, List, Optional
import httpx

from core_ai.contracts.errors import ToolExecutionError
from core_ai.contracts.mcp import ToolDefinition, ToolScope

logger = logging.getLogger("core_ai.mcp.client_manager")


class MCPClientManager:
    """Manages MCP client connections over streamable-http and stdio transports.

    Provides multi-transport tool invocation with connection reuse, graceful fallbacks,
    and automatic discovery.
    """

    def __init__(self, default_transport: str = "streamable-http") -> None:
        self.default_transport = default_transport
        self._servers: Dict[str, Dict[str, Any]] = {}
        self._http_client: Optional[httpx.AsyncClient] = None

    async def _get_http_client(self) -> httpx.AsyncClient:
        """Returns or creates a reusable HTTP client with connection pooling."""
        if self._http_client is None or self._http_client.is_closed:
            self._http_client = httpx.AsyncClient(
                timeout=httpx.Timeout(connect=3.0, read=5.0, write=3.0, pool=5.0),
                limits=httpx.Limits(max_connections=20, max_keepalive_connections=10),
            )
        return self._http_client

    def register_server(
        self,
        server_id: str,
        transport: str = "streamable-http",
        endpoint_or_command: str = "",
        headers: Optional[Dict[str, str]] = None,
        env: Optional[Dict[str, str]] = None,
    ) -> None:
        """Registers a remote MCP server definition for transport management."""
        self._servers[server_id] = {
            "server_id": server_id,
            "transport": transport,
            "target": endpoint_or_command,
            "headers": headers or {},
            "env": env or {},
            "active": True,
        }
        logger.info(
            "Registered MCP server '%s' with transport '%s' (target: %s)",
            server_id,
            transport,
            endpoint_or_command,
        )

    async def execute_remote_tool(
        self,
        server_id: str,
        tool_name: str,
        arguments: Dict[str, Any],
        timeout_seconds: float = 3.0,
    ) -> Dict[str, Any]:
        """Executes a tool on a remote MCP server via streamable-http or stdio."""
        server_config = self._servers.get(server_id)
        if not server_config:
            raise ToolExecutionError(f"Máy chủ MCP '{server_id}' chưa được cấu hình")

        transport = server_config["transport"]

        if transport in ("streamable-http", "http", "sse"):
            return await self._call_via_http(
                endpoint=server_config["target"],
                tool_name=tool_name,
                arguments=arguments,
                headers=server_config["headers"],
                timeout_seconds=timeout_seconds,
            )
        elif transport == "stdio":
            return await self._call_via_stdio(
                command=server_config["target"],
                tool_name=tool_name,
                arguments=arguments,
                env=server_config["env"],
                timeout_seconds=timeout_seconds,
            )
        else:
            raise ToolExecutionError(f"Giao thức MCP transport '{transport}' không được hỗ trợ")

    async def _call_via_http(
        self,
        endpoint: str,
        tool_name: str,
        arguments: Dict[str, Any],
        headers: Dict[str, str],
        timeout_seconds: float,
    ) -> Dict[str, Any]:
        """Calls an MCP tool over streamable-http transport."""
        client = await self._get_http_client()
        payload = {
            "jsonrpc": "2.0",
            "method": "tools/call",
            "params": {
                "name": tool_name,
                "arguments": arguments,
            },
            "id": 1,
        }

        try:
            response = await client.post(
                endpoint,
                json=payload,
                headers={
                    "Content-Type": "application/json",
                    "Accept": "application/json, text/event-stream",
                    **headers,
                },
                timeout=timeout_seconds,
            )
            response.raise_for_status()

            data = response.json()
            if "error" in data:
                err = data["error"]
                err_msg = err.get("message", "MCP Remote RPC error")
                raise ToolExecutionError(f"Lỗi từ máy chủ MCP ({endpoint}): {err_msg}")

            result = data.get("result", {})
            return result.get("data", result)
        except httpx.TimeoutException as exc:
            raise ToolExecutionError(
                f"Gọi công cụ '{tool_name}' qua HTTP ({endpoint}) bị quá hạn ({timeout_seconds}s)"
            ) from exc
        except httpx.HTTPStatusError as exc:
            raise ToolExecutionError(
                f"Máy chủ MCP ({endpoint}) phản hồi lỗi HTTP {exc.response.status_code}"
            ) from exc
        except Exception as exc:
            raise ToolExecutionError(
                f"Không thể kết nối máy chủ MCP ({endpoint}): {str(exc)}"
            ) from exc

    async def _call_via_stdio(
        self,
        command: str,
        tool_name: str,
        arguments: Dict[str, Any],
        env: Dict[str, str],
        timeout_seconds: float,
    ) -> Dict[str, Any]:
        """Calls an MCP tool over local stdio transport subprocess."""
        payload = {
            "jsonrpc": "2.0",
            "method": "tools/call",
            "params": {
                "name": tool_name,
                "arguments": arguments,
            },
            "id": 1,
        }

        try:
            proc = await asyncio.create_subprocess_shell(
                command,
                stdin=asyncio.subprocess.PIPE,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                env={**env},
            )

            req_bytes = (json.dumps(payload) + "\n").encode("utf-8")
            stdout_data, stderr_data = await asyncio.wait_for(
                proc.communicate(input=req_bytes),
                timeout=timeout_seconds,
            )

            if proc.returncode != 0:
                err_str = stderr_data.decode("utf-8", errors="replace").strip()
                raise ToolExecutionError(
                    f"Tiến trình MCP stdio thất bại (code {proc.returncode}): {err_str}"
                )

            line = stdout_data.decode("utf-8", errors="replace").strip()
            data = json.loads(line)
            if "error" in data:
                err_msg = data["error"].get("message", "MCP stdio RPC error")
                raise ToolExecutionError(f"Lỗi từ MCP stdio process: {err_msg}")

            result = data.get("result", {})
            return result.get("data", result)
        except asyncio.TimeoutError as exc:
            raise ToolExecutionError(
                f"Tiến trình MCP stdio '{command}' bị quá hạn ({timeout_seconds}s)"
            ) from exc
        except Exception as exc:
            raise ToolExecutionError(
                f"Lỗi khi thực thi MCP stdio subprocess: {str(exc)}"
            ) from exc

    async def discover_tools(self, server_id: str) -> List[ToolDefinition]:
        """Discovers tools advertised by a registered remote MCP server."""
        server_config = self._servers.get(server_id)
        if not server_config:
            return []

        transport = server_config["transport"]
        if transport in ("streamable-http", "http", "sse"):
            client = await self._get_http_client()
            payload = {
                "jsonrpc": "2.0",
                "method": "tools/list",
                "params": {},
                "id": 1,
            }
            try:
                response = await client.post(
                    server_config["target"],
                    json=payload,
                    headers=server_config["headers"],
                    timeout=3.0,
                )
                if response.status_code == 200:
                    data = response.json()
                    tools_raw = data.get("result", {}).get("tools", [])
                    discovered: List[ToolDefinition] = []
                    for t in tools_raw:
                        discovered.append(
                            ToolDefinition(
                                name=t.get("name"),
                                description=t.get("description", ""),
                                scope=ToolScope(t.get("scope", "public")),
                                input_schema=t.get("inputSchema", {}),
                                output_schema=t.get("outputSchema"),
                                timeout_seconds=t.get("timeout_seconds", 3.0),
                            )
                        )
                    return discovered
            except Exception as exc:
                logger.warning(
                    "Failed to discover tools from remote server '%s': %s",
                    server_id,
                    str(exc),
                )
        return []

    async def close(self) -> None:
        """Closes any underlying network connections."""
        if self._http_client and not self._http_client.is_closed:
            await self._http_client.aclose()
            logger.info("Closed MCP Client Manager HTTP transport connection pool.")
