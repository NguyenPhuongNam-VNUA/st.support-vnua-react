"""Model Context Protocol (MCP) Tool Gateway contracts.

Defines schemas and protocols for model-independent MCP tool execution,
circuit breakers, tool allowlists, and access control.
"""

import time
from enum import Enum
from typing import Any, Dict, List, Optional, Protocol, Union, runtime_checkable

from pydantic import BaseModel, Field, model_validator


class ToolScope(str, Enum):
    """Access control scope restricting tool execution."""
    PUBLIC = "public"                # Open to all students & anonymous users (e.g. search_knowledge)
    AUTHENTICATED = "authenticated"  # Requires verified student user_id (e.g. lookup_schedule, check_tuition)
    ADMIN = "admin"                  # Restricted to administrative roles
    ESCALATION = "escalation"        # Accessible exclusively during HITL escalation (create_support_case)


class CircuitBreakerState(str, Enum):
    """Per-tool circuit breaker operating state."""
    CLOSED = "closed"        # Normal state: tool calls permitted
    OPEN = "open"            # Tripped state: calls fail fast immediately
    HALF_OPEN = "half_open"  # Trial probe state: permits canary requests to test recovery


class CircuitBreakerConfig(BaseModel):
    """Circuit breaker configuration parameters."""
    failure_threshold: int = Field(
        default=3,
        description="Consecutive failures before tripping from CLOSED to OPEN",
    )
    recovery_timeout_seconds: float = Field(
        default=30.0,
        description="Seconds to remain in OPEN before transitioning to HALF_OPEN probe",
    )
    half_open_success_threshold: int = Field(
        default=2,
        description="Consecutive successes in HALF_OPEN to re-close breaker",
    )


class ToolCircuitStatus(BaseModel):
    """Runtime circuit breaker telemetry for a single tool."""
    tool_name: str
    state: CircuitBreakerState = CircuitBreakerState.CLOSED
    consecutive_failures: int = 0
    consecutive_successes: int = 0
    last_failure_timestamp: Optional[float] = None
    last_state_change: float = Field(default_factory=time.time)


class ToolDefinition(BaseModel):
    """Declarative specification of an MCP tool."""
    name: str = Field(..., description="Unique tool identifier in allowlist")
    description: str = Field(..., description="Detailed description for tool routing")
    scope: ToolScope = Field(default=ToolScope.PUBLIC, description="Scope required to run tool")
    input_schema: Dict[str, Any] = Field(..., description="JSON Schema for tool arguments")
    output_schema: Optional[Dict[str, Any]] = Field(default=None)
    timeout_seconds: float = Field(default=3.0, description="Per-tool timeout (default 3s)")
    requires_approval: bool = Field(
        default=False,
        description="True if tool requires explicit student or staff confirmation",
    )


class ToolRequest(BaseModel):
    """Tenant-isolated tool invocation request."""
    request_id: str = Field(..., description="Correlated trace UUID")
    tenant_id: str = Field(default="vnua", description="Mandatory tenant isolation identifier")
    user_id: Optional[Union[int, str]] = Field(
        default=None,
        description="Student ID for authenticated scope checking",
    )
    tool_name: str = Field(..., description="Name of tool to execute")
    arguments: Dict[str, Any] = Field(default_factory=dict, description="Tool invocation parameters")
    timeout_seconds: float = Field(default=3.0, ge=0.5, le=10.0)
    approved: bool = Field(default=False, description="Approval for tools with side effects")


class ToolResult(BaseModel):
    """Standardized result returned from tool execution."""
    tool_name: str
    success: bool
    data: Optional[Any] = Field(default=None, description="Structured output payload")
    raw_output: Optional[str] = Field(default=None, description="Serialized text representation")
    error: Optional[str] = Field(default=None, description="Sanitized error description")
    error_message: Optional[str] = Field(default=None, description="Alias for error")
    latency_ms: int = Field(default=0, ge=0)
    cached: bool = Field(default=False)

    @property
    def is_error(self) -> bool:
        """Indicates whether tool invocation resulted in failure."""
        return not self.success

    @model_validator(mode="after")
    def sync_error_alias(self) -> "ToolResult":
        if self.error_message is None:
            self.error_message = self.error
        if self.error is None:
            self.error = self.error_message
        return self


@runtime_checkable
class MCPGateway(Protocol):
    """Abstract Gateway managing MCP clients, transport, allowlist, and circuit breakers."""

    async def call_tool(self, request: ToolRequest) -> ToolResult:
        """Executes tool call with allowlist checking, ACL, timeout, and circuit breaker.

        Raises:
            ToolExecutionError: If tool fails or argument schema validation fails.
            CircuitBreakerOpenError: If tool's circuit breaker is in OPEN state.
            ToolNotAllowedError: If tool is not permitted or caller lacks scope.
        """
        ...

    async def discover_tools(self) -> List[ToolDefinition]:
        """Discovers all tools advertised by connected MCP servers."""
        ...

    async def list_tools(
        self, tenant_id: str, user_id: Optional[Union[int, str]] = None
    ) -> List[ToolDefinition]:
        """Returns permitted tools filtered by tenant and caller scope."""
        ...

    async def get_tool_health(self) -> Dict[str, ToolCircuitStatus]:
        """Returns health and circuit breaker status across all registered tools."""
        ...
