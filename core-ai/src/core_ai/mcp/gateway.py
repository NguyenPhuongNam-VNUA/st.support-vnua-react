"""MCP Gateway Implementation for ST-Care VNUA.

Implements core_ai.contracts.mcp.MCPGateway protocol with allowlist filtering,
tenant/user ACL verification, 3.0-second timeout, 3-state Circuit Breaker,
and multi-transport dispatch (in-process, streamable-http, stdio).
"""

import asyncio
import json
import logging
import time
from typing import Any, Dict, List, Optional, Union

from core_ai.config import Settings, get_settings
from core_ai.contracts.errors import (
    CircuitBreakerOpenError,
    CoreAIError,
    TenantForbiddenError,
    ToolExecutionError,
    ToolNotAllowedError,
)
from core_ai.contracts.mcp import (
    CircuitBreakerConfig,
    MCPGateway as MCPGatewayProtocol,
    ToolCircuitStatus,
    ToolDefinition,
    ToolRequest,
    ToolResult,
)
from core_ai.dependencies import register_component
from core_ai.mcp.circuit_breaker import ToolCircuitBreaker
from core_ai.mcp.client_manager import MCPClientManager
from core_ai.mcp.registry import RegisteredTool, ToolRegistry
from core_ai.observability.metrics import record_mcp_tool

logger = logging.getLogger("core_ai.mcp.gateway")


class MCPGatewayImpl:
    """Production implementation of MCPGateway conforming to core_ai.contracts.mcp.MCPGateway."""

    def __init__(
        self,
        registry: Optional[ToolRegistry] = None,
        circuit_breaker: Optional[ToolCircuitBreaker] = None,
        client_manager: Optional[MCPClientManager] = None,
        settings: Optional[Settings] = None,
    ) -> None:
        self.settings = settings or get_settings()
        self.registry = registry or ToolRegistry()
        self.circuit_breaker = circuit_breaker or ToolCircuitBreaker(
            CircuitBreakerConfig(
                failure_threshold=3,
                recovery_timeout_seconds=30.0,
                half_open_success_threshold=2,
            )
        )
        self.client_manager = client_manager or MCPClientManager(
            default_transport=self.settings.mcp_transport
        )
        self.default_timeout_seconds = self.settings.mcp_tool_timeout_seconds

    @property
    def allowed_tools(self) -> List[str]:
        """Returns the current list of allowed tool names from settings."""
        tools = self.settings.mcp_allowed_tools
        if isinstance(tools, str):
            return [t.strip() for t in tools.split(",") if t.strip()]
        return list(tools)

    async def call_tool(self, request: ToolRequest) -> ToolResult:
        """Executes a tool call with allowlist checking, ACL, 3.0s timeout, and circuit breaker.

        Args:
            request: Tenant-isolated tool invocation request.

        Returns:
            ToolResult containing structured output payload and execution telemetry.

        Raises:
            ToolExecutionError: If tool fails or argument schema validation fails.
            CircuitBreakerOpenError: If tool's circuit breaker is in OPEN state.
            ToolNotAllowedError: If tool is not permitted or caller lacks scope.
        """
        tool_name = request.tool_name
        start_time = time.perf_counter()

        logger.info(
            "MCPGateway received request_id='%s' tool='%s' tenant='%s' user='%s'",
            request.request_id,
            tool_name,
            request.tenant_id,
            request.user_id,
        )

        allowed_tenants = self.settings.allowed_tenants
        if isinstance(allowed_tenants, str):
            allowed_tenants = [
                item.strip() for item in allowed_tenants.split(",") if item.strip()
            ]
        if request.tenant_id not in allowed_tenants:
            raise TenantForbiddenError("Tenant không được phép thực thi công cụ")

        # 1. Allowlist & ACL Scope Validation
        registered_tool: RegisteredTool = self.registry.validate_tool_call(
            request, allowed_tools=self.allowed_tools
        )

        # 2. Circuit Breaker Check
        can_run = await self.circuit_breaker.can_execute(tool_name)
        if not can_run:
            logger.warning(
                "Circuit breaker is OPEN for tool '%s'. Failing fast.",
                tool_name,
            )
            raise CircuitBreakerOpenError(tool_name)

        # 3. Determine strict effective timeout (enforcing max 3.0s per requirement)
        effective_timeout = min(
            request.timeout_seconds,
            self.default_timeout_seconds,
            registered_tool.definition.timeout_seconds,
        )

        # 4. Dispatch Tool Execution with Timeout
        try:
            raw_data = await asyncio.wait_for(
                self._dispatch_tool_execution(registered_tool, request, effective_timeout),
                timeout=effective_timeout,
            )
            self.registry.validate_tool_output(registered_tool, raw_data)
            encoded_size = len(json.dumps(raw_data, ensure_ascii=False, default=str).encode("utf-8"))
            if encoded_size > self.settings.mcp_max_result_bytes:
                raise ToolExecutionError(
                    f"Kết quả công cụ '{tool_name}' vượt quá giới hạn kích thước"
                )

            # Record healthy execution in circuit breaker
            await self.circuit_breaker.record_success(tool_name)

            elapsed_ms = int((time.perf_counter() - start_time) * 1000)
            record_mcp_tool(tool_name, "success", elapsed_ms / 1000.0)

            raw_output = (
                json.dumps(raw_data, ensure_ascii=False, default=str)
                if isinstance(raw_data, (dict, list))
                else str(raw_data)
            )

            logger.info(
                "Tool '%s' completed successfully in %d ms",
                tool_name,
                elapsed_ms,
            )

            return ToolResult(
                tool_name=tool_name,
                success=True,
                data=raw_data,
                raw_output=raw_output,
                error=None,
                error_message=None,
                latency_ms=elapsed_ms,
                cached=False,
            )

        except asyncio.TimeoutError as exc:
            await self.circuit_breaker.record_failure(tool_name, exc)
            elapsed_ms = int((time.perf_counter() - start_time) * 1000)
            record_mcp_tool(tool_name, "timeout", elapsed_ms / 1000.0)
            err_msg = (
                f"Công cụ '{tool_name}' vượt quá thời gian phản hồi cho phép "
                f"({effective_timeout:.1f}s) sau {elapsed_ms}ms"
            )
            logger.error(err_msg)
            raise ToolExecutionError(err_msg) from exc

        except CoreAIError as exc:
            # Domain errors (e.g. ToolExecutionError)
            await self.circuit_breaker.record_failure(tool_name, exc)
            record_mcp_tool(tool_name, "error", time.perf_counter() - start_time)
            logger.error("CoreAIError executing tool '%s': %s", tool_name, exc.message)
            raise

        except Exception as exc:
            # Unhandled errors
            await self.circuit_breaker.record_failure(tool_name, exc)
            elapsed_ms = int((time.perf_counter() - start_time) * 1000)
            record_mcp_tool(tool_name, "error", elapsed_ms / 1000.0)
            err_msg = f"Không thể thực thi công cụ '{tool_name}'"
            logger.error(err_msg, exc_info=True)
            raise ToolExecutionError(err_msg) from exc

    async def _dispatch_tool_execution(
        self,
        registered: RegisteredTool,
        request: ToolRequest,
        timeout_seconds: float,
    ) -> Dict[str, Any]:
        """Dispatches tool execution to either local handler or remote MCP server."""
        if registered.is_remote and registered.server_id:
            return await self.client_manager.execute_remote_tool(
                server_id=registered.server_id,
                tool_name=registered.definition.name,
                arguments=request.arguments,
                timeout_seconds=timeout_seconds,
                context_headers={
                    "X-Tenant-ID": request.tenant_id,
                    "X-User-ID": str(request.user_id or ""),
                    "X-Request-ID": request.request_id,
                    "Idempotency-Key": request.request_id,
                },
            )
        elif registered.handler:
            trusted_arguments = dict(request.arguments)
            trusted_arguments["_tenant_id"] = request.tenant_id
            trusted_arguments["_user_id"] = request.user_id
            trusted_arguments["_request_id"] = request.request_id
            trusted_arguments["_settings"] = self.settings
            return await registered.handler(trusted_arguments)
        else:
            raise ToolExecutionError(
                f"Không có handler hoặc cấu hình server nào cho công cụ '{registered.definition.name}'"
            )

    async def discover_tools(self) -> List[ToolDefinition]:
        """Discovers all tools advertised across registry and connected MCP servers."""
        definitions = self.registry.list_all_definitions()
        return definitions

    async def list_tools(
        self, tenant_id: str, user_id: Optional[Union[int, str]] = None
    ) -> List[ToolDefinition]:
        """Returns permitted tools filtered by tenant, caller scope, and allowlist."""
        return self.registry.list_tools(
            tenant_id=tenant_id,
            user_id=user_id,
            allowed_tools=self.allowed_tools,
        )

    async def get_tool_health(self) -> Dict[str, ToolCircuitStatus]:
        """Returns health and circuit breaker status across all registered tools."""
        statuses = self.circuit_breaker.get_all_statuses()
        # Ensure every registered tool has a reported status
        for tool_def in self.registry.list_all_definitions():
            if tool_def.name not in statuses:
                statuses[tool_def.name] = self.circuit_breaker.get_status(tool_def.name)
        return statuses

    async def close(self) -> None:
        """Closes client manager connections."""
        await self.client_manager.close()


# Singleton instance
_global_mcp_gateway: Optional[MCPGatewayImpl] = None


def get_mcp_gateway(settings: Optional[Settings] = None) -> MCPGatewayImpl:
    """Returns singleton instance of MCPGatewayImpl, registering it in dependencies."""
    global _global_mcp_gateway
    if _global_mcp_gateway is None:
        _global_mcp_gateway = MCPGatewayImpl(settings=settings)
        # Register singleton into application container per Requirement 6
        register_component("mcp_gateway", _global_mcp_gateway)
        logger.info("Initialized and registered global MCP Gateway singleton.")
    return _global_mcp_gateway
