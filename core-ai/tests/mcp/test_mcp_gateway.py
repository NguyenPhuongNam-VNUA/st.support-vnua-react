"""MCP Tests for MCPGateway, Registry, and Tool Access Control.

Tests:
1. Tool allowlist enforcement: disallowed tools trigger ToolNotAllowedError.
2. Tool scope enforcement: AUTHENTICATED scope rejected when user_id is missing.
3. Successful execution of built-in tool (e.g. search_knowledge or get_regulations).
4. Argument schema validation failure triggers ToolExecutionError.
5. Per-tool timeout configuration (default 3.0s).
"""

from unittest.mock import AsyncMock
import pytest

from core_ai.config import Settings
from core_ai.contracts.errors import TenantForbiddenError, ToolExecutionError, ToolNotAllowedError
from core_ai.contracts.mcp import ToolRequest, ToolResult, ToolScope
from core_ai.mcp.gateway import MCPGatewayImpl
from core_ai.mcp.registry import ToolRegistry


class TestMCPGateway:
    @pytest.fixture
    def mcp_gateway(self, mock_settings: Settings) -> MCPGatewayImpl:
        return MCPGatewayImpl(settings=mock_settings)

    @pytest.mark.asyncio
    async def test_disallowed_tool_rejected(self, mcp_gateway: MCPGatewayImpl) -> None:
        """Tool not in allowed_tools list raises ToolNotAllowedError."""
        req = ToolRequest(
            request_id="req-mcp-disallowed",
            tenant_id="vnua",
            tool_name="unregistered_dangerous_tool",
            arguments={},
        )

        with pytest.raises(ToolNotAllowedError) as exc_info:
            await mcp_gateway.call_tool(req)
        assert exc_info.value.code.value == "TOOL_NOT_ALLOWED"

    @pytest.mark.asyncio
    async def test_authenticated_scope_requires_user_id(
        self, mcp_gateway: MCPGatewayImpl
    ) -> None:
        """Tool with AUTHENTICATED scope (lookup_schedule) requires user_id; raises ToolNotAllowedError if missing."""
        req = ToolRequest(
            request_id="req-mcp-no-user",
            tenant_id="vnua",
            user_id=None,  # Missing student identity
            tool_name="lookup_schedule",
            arguments={"semester": 1},
        )

        with pytest.raises(ToolNotAllowedError) as exc_info:
            await mcp_gateway.call_tool(req)
        assert exc_info.value.code.value == "TOOL_NOT_ALLOWED"

    @pytest.mark.asyncio
    async def test_public_tool_execution_success(
        self, mcp_gateway: MCPGatewayImpl
    ) -> None:
        """Tool with PUBLIC scope (get_regulations) executes successfully without user_id."""
        registered = mcp_gateway.registry.get_tool("get_regulations")
        assert registered is not None
        registered.handler = AsyncMock(
            return_value={"category_filter": "dao_tao", "total_matches": 0, "regulations": []}
        )
        req = ToolRequest(
            request_id="req-mcp-public",
            tenant_id="vnua",
            tool_name="get_regulations",
            arguments={"category": "dao_tao", "keywords": "thang điểm"},
        )

        res: ToolResult = await mcp_gateway.call_tool(req)
        assert res.success is True
        assert res.is_error is False
        assert res.tool_name == "get_regulations"
        assert res.data is not None

    @pytest.mark.asyncio
    async def test_missing_required_arguments_raises_error(
        self, mcp_gateway: MCPGatewayImpl
    ) -> None:
        """Missing mandatory argument defined in tool input_schema raises ToolExecutionError."""
        req = ToolRequest(
            request_id="req-mcp-missing-arg",
            tenant_id="vnua",
            tool_name="search_knowledge",
            arguments={},  # 'query' is required
        )

        with pytest.raises(ToolExecutionError) as exc_info:
            await mcp_gateway.call_tool(req)
        assert "tham số không hợp lệ" in exc_info.value.message.lower()

    @pytest.mark.asyncio
    async def test_escalation_requires_authenticated_user_and_approval(
        self, mcp_gateway: MCPGatewayImpl
    ) -> None:
        arguments = {
            "student_id": "42",
            "category": "dao_tao",
            "subject": "Cần hỗ trợ đăng ký",
            "details": "Không thể đăng ký học phần bắt buộc",
        }
        with pytest.raises(ToolNotAllowedError):
            await mcp_gateway.call_tool(
                ToolRequest(
                    request_id="req-no-approval",
                    tenant_id="vnua",
                    user_id="42",
                    tool_name="create_support_case",
                    arguments=arguments,
                    approved=False,
                )
            )

    @pytest.mark.asyncio
    async def test_cross_tenant_tool_call_is_denied(
        self, mcp_gateway: MCPGatewayImpl
    ) -> None:
        with pytest.raises(TenantForbiddenError):
            await mcp_gateway.call_tool(
                ToolRequest(
                    request_id="req-cross-tenant",
                    tenant_id="foreign_university",
                    tool_name="get_regulations",
                    arguments={},
                )
            )

    @pytest.mark.asyncio
    async def test_local_tool_timeout_is_enforced(
        self, mcp_gateway: MCPGatewayImpl
    ) -> None:
        import asyncio

        registered = mcp_gateway.registry.get_tool("get_regulations")
        assert registered is not None

        async def slow_handler(arguments):
            del arguments
            await asyncio.sleep(0.1)
            return {}

        registered.handler = slow_handler
        registered.definition.timeout_seconds = 0.01
        with pytest.raises(ToolExecutionError):
            await mcp_gateway.call_tool(
                ToolRequest(
                    request_id="req-timeout",
                    tenant_id="vnua",
                    tool_name="get_regulations",
                    arguments={},
                )
            )
