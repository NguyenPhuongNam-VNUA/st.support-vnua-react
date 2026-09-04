"""MCP Server implementation for ST-Care VNUA.

Exposes registered core-ai tools to external microservices or developer CLI
over streamable-http (SSE/JSON-RPC) and stdio transports using official MCP protocols.
"""

import json
import logging
from typing import Any, Dict, Optional
from fastapi import APIRouter, Request, status
from fastapi.responses import JSONResponse, StreamingResponse

from core_ai.contracts.errors import CoreAIError, ErrorCode
from core_ai.contracts.mcp import ToolRequest
from core_ai.mcp.registry import ToolRegistry

logger = logging.getLogger("core_ai.mcp.server")


class MCPServer:
    """Server hosting MCP tools for internal and external consumption."""

    def __init__(self, registry: Optional[ToolRegistry] = None) -> None:
        self.registry = registry or ToolRegistry()
        self.router = APIRouter(prefix="/mcp", tags=["MCP Server"])
        self._setup_routes()

    def _setup_routes(self) -> None:
        """Registers HTTP and SSE endpoints for streamable-http transport."""

        @self.router.post("")
        async def handle_rpc(request: Request) -> JSONResponse:
            """JSON-RPC 2.0 endpoint handling tools/list and tools/call requests."""
            try:
                payload = await request.json()
            except Exception:
                return JSONResponse(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    content={
                        "jsonrpc": "2.0",
                        "error": {"code": -32700, "message": "Parse error: Invalid JSON"},
                        "id": None,
                    },
                )

            method = payload.get("method")
            req_id = payload.get("id")
            params = payload.get("params", {})

            if method == "tools/list":
                tenant_id = params.get("tenant_id", "vnua")
                user_id = params.get("user_id")
                tools = self.registry.list_tools(tenant_id=tenant_id, user_id=user_id)
                formatted_tools = [
                    {
                        "name": t.name,
                        "description": t.description,
                        "scope": t.scope.value,
                        "inputSchema": t.input_schema,
                        "outputSchema": t.output_schema,
                        "timeout_seconds": t.timeout_seconds,
                    }
                    for t in tools
                ]
                return JSONResponse(
                    content={
                        "jsonrpc": "2.0",
                        "result": {"tools": formatted_tools},
                        "id": req_id,
                    }
                )

            elif method == "tools/call":
                tool_name = params.get("name")
                arguments = params.get("arguments", {})
                tenant_id = params.get("tenant_id", "vnua")
                user_id = params.get("user_id")

                tool_req = ToolRequest(
                    request_id=str(req_id or "mcp-server-req"),
                    tenant_id=tenant_id,
                    user_id=user_id,
                    tool_name=tool_name,
                    arguments=arguments,
                )

                try:
                    registered_tool = self.registry.validate_tool_call(tool_req)
                    if not registered_tool.handler:
                        return JSONResponse(
                            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            content={
                                "jsonrpc": "2.0",
                                "error": {
                                    "code": -32603,
                                    "message": f"Handler not registered for tool '{tool_name}'",
                                },
                                "id": req_id,
                            },
                        )

                    data = await registered_tool.handler(arguments)
                    return JSONResponse(
                        content={
                            "jsonrpc": "2.0",
                            "result": {"data": data},
                            "id": req_id,
                        }
                    )
                except CoreAIError as err:
                    return JSONResponse(
                        status_code=err.status_code,
                        content={
                            "jsonrpc": "2.0",
                            "error": {
                                "code": -32000,
                                "message": err.message,
                                "data": err.to_dict(),
                            },
                            "id": req_id,
                        },
                    )
                except Exception as exc:
                    logger.error("Unhandled error executing tool '%s': %s", tool_name, str(exc))
                    return JSONResponse(
                        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                        content={
                            "jsonrpc": "2.0",
                            "error": {
                                "code": -32603,
                                "message": f"Internal tool execution error: {str(exc)}",
                            },
                            "id": req_id,
                        },
                    )

            else:
                return JSONResponse(
                    status_code=status.HTTP_404_NOT_FOUND,
                    content={
                        "jsonrpc": "2.0",
                        "error": {
                            "code": -32601,
                            "message": f"Method '{method}' not found",
                        },
                        "id": req_id,
                    },
                )

        @self.router.get("/sse")
        async def handle_sse(request: Request) -> StreamingResponse:
            """SSE endpoint for streaming MCP transports."""
            async def event_generator():
                init_event = {
                    "event": "endpoint",
                    "data": "/mcp",
                }
                yield f"event: {init_event['event']}\ndata: {init_event['data']}\n\n"

            return StreamingResponse(
                event_generator(),
                media_type="text/event-stream",
                headers={
                    "Cache-Control": "no-cache",
                    "Connection": "keep-alive",
                    "X-Accel-Buffering": "no",
                },
            )


def create_mcp_server(registry: Optional[ToolRegistry] = None) -> MCPServer:
    """Factory creating an MCPServer instance with registered tools."""
    return MCPServer(registry=registry)
