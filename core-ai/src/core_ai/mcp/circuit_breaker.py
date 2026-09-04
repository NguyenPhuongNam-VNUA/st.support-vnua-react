"""Per-tool 3-state Circuit Breaker for MCP Gateway.

Prevents cascading failures, resource exhaustion, and latency loops by monitoring
tool failure rates and enforcing CLOSED -> OPEN -> HALF_OPEN -> CLOSED state transitions.
"""

import asyncio
import logging
import time
from typing import Dict, Optional

from core_ai.contracts.mcp import (
    CircuitBreakerConfig,
    CircuitBreakerState,
    ToolCircuitStatus,
)

logger = logging.getLogger("core_ai.mcp.circuit_breaker")


class ToolCircuitBreaker:
    """Thread-safe & async-safe 3-state Circuit Breaker for individual MCP tools.

    States:
        CLOSED: Normal operation. All tool calls proceed.
        OPEN: Tripped due to consecutive failures exceeding threshold. Calls fail immediately.
        HALF_OPEN: Trial probe period. Allows canary calls to test recovery.
    """

    def __init__(self, config: Optional[CircuitBreakerConfig] = None) -> None:
        self.config = config or CircuitBreakerConfig()
        self._statuses: Dict[str, ToolCircuitStatus] = {}
        self._lock = asyncio.Lock()

    def _get_or_create_status(self, tool_name: str) -> ToolCircuitStatus:
        """Retrieves or initializes telemetry record for a specific tool."""
        if tool_name not in self._statuses:
            self._statuses[tool_name] = ToolCircuitStatus(
                tool_name=tool_name,
                state=CircuitBreakerState.CLOSED,
                consecutive_failures=0,
                consecutive_successes=0,
                last_failure_timestamp=None,
                last_state_change=time.time(),
            )
        return self._statuses[tool_name]

    async def can_execute(self, tool_name: str) -> bool:
        """Evaluates whether an execution attempt is allowed for the given tool.

        If the circuit is OPEN and recovery_timeout_seconds has elapsed, transitions
        the tool to HALF_OPEN for a canary probe.
        """
        async with self._lock:
            status = self._get_or_create_status(tool_name)
            current_time = time.time()

            if status.state == CircuitBreakerState.CLOSED:
                return True

            if status.state == CircuitBreakerState.OPEN:
                last_failure = status.last_failure_timestamp or status.last_state_change
                elapsed = current_time - last_failure

                if elapsed >= self.config.recovery_timeout_seconds:
                    logger.info(
                        "Circuit breaker for tool '%s' transitioning from OPEN to HALF_OPEN "
                        "(elapsed: %.2fs >= %.2fs). Permitting canary probe.",
                        tool_name,
                        elapsed,
                        self.config.recovery_timeout_seconds,
                    )
                    status.state = CircuitBreakerState.HALF_OPEN
                    status.consecutive_successes = 0
                    status.last_state_change = current_time
                    return True
                else:
                    logger.warning(
                        "Circuit breaker for tool '%s' is OPEN. Tripped %.2fs ago. "
                        "Rejecting call (retry in %.2fs).",
                        tool_name,
                        elapsed,
                        self.config.recovery_timeout_seconds - elapsed,
                    )
                    return False

            if status.state == CircuitBreakerState.HALF_OPEN:
                # Permit canary executions
                return True

            return False

    async def record_success(self, tool_name: str) -> None:
        """Records a successful tool execution, handling recovery transitions."""
        async with self._lock:
            status = self._get_or_create_status(tool_name)
            current_time = time.time()

            if status.state == CircuitBreakerState.HALF_OPEN:
                status.consecutive_successes += 1
                logger.info(
                    "Canary success for tool '%s' (%d/%d required).",
                    tool_name,
                    status.consecutive_successes,
                    self.config.half_open_success_threshold,
                )

                if status.consecutive_successes >= self.config.half_open_success_threshold:
                    logger.info(
                        "Circuit breaker for tool '%s' fully recovered. "
                        "Transitioning from HALF_OPEN to CLOSED.",
                        tool_name,
                    )
                    status.state = CircuitBreakerState.CLOSED
                    status.consecutive_failures = 0
                    status.consecutive_successes = 0
                    status.last_state_change = current_time
            elif status.state == CircuitBreakerState.CLOSED:
                # Reset failure counter on healthy calls
                status.consecutive_failures = 0

    async def record_failure(
        self, tool_name: str, error: Optional[Exception] = None
    ) -> None:
        """Records a tool failure or timeout, potentially tripping the circuit to OPEN."""
        async with self._lock:
            status = self._get_or_create_status(tool_name)
            current_time = time.time()
            status.consecutive_failures += 1
            status.last_failure_timestamp = current_time

            err_msg = str(error) if error else "Unknown failure or timeout"

            if status.state == CircuitBreakerState.HALF_OPEN:
                logger.error(
                    "Canary probe failed for tool '%s' during HALF_OPEN: %s. "
                    "Tripping immediately back to OPEN.",
                    tool_name,
                    err_msg,
                )
                status.state = CircuitBreakerState.OPEN
                status.consecutive_successes = 0
                status.last_state_change = current_time
            elif status.state == CircuitBreakerState.CLOSED:
                if status.consecutive_failures >= self.config.failure_threshold:
                    logger.error(
                        "Tool '%s' reached failure threshold (%d/%d consecutive failures): %s. "
                        "Tripping circuit breaker from CLOSED to OPEN.",
                        tool_name,
                        status.consecutive_failures,
                        self.config.failure_threshold,
                        err_msg,
                    )
                    status.state = CircuitBreakerState.OPEN
                    status.consecutive_successes = 0
                    status.last_state_change = current_time
                else:
                    logger.warning(
                        "Tool '%s' failed (%d/%d before tripping): %s",
                        tool_name,
                        status.consecutive_failures,
                        self.config.failure_threshold,
                        err_msg,
                    )

    async def trip(self, tool_name: str) -> None:
        """Manually forces a tool's circuit breaker to OPEN."""
        async with self._lock:
            status = self._get_or_create_status(tool_name)
            status.state = CircuitBreakerState.OPEN
            status.last_failure_timestamp = time.time()
            status.last_state_change = time.time()
            status.consecutive_successes = 0
            logger.warning("Circuit breaker for tool '%s' manually tripped to OPEN.", tool_name)

    async def reset(self, tool_name: Optional[str] = None) -> None:
        """Resets telemetry for a specific tool or all tools to CLOSED."""
        async with self._lock:
            current_time = time.time()
            if tool_name:
                if tool_name in self._statuses:
                    self._statuses[tool_name] = ToolCircuitStatus(
                        tool_name=tool_name,
                        state=CircuitBreakerState.CLOSED,
                        consecutive_failures=0,
                        consecutive_successes=0,
                        last_failure_timestamp=None,
                        last_state_change=current_time,
                    )
                    logger.info("Circuit breaker for tool '%s' reset to CLOSED.", tool_name)
            else:
                for name in list(self._statuses.keys()):
                    self._statuses[name] = ToolCircuitStatus(
                        tool_name=name,
                        state=CircuitBreakerState.CLOSED,
                        consecutive_failures=0,
                        consecutive_successes=0,
                        last_failure_timestamp=None,
                        last_state_change=current_time,
                    )
                logger.info("All circuit breakers reset to CLOSED.")

    def get_status(self, tool_name: str) -> ToolCircuitStatus:
        """Returns instantaneous snapshot of tool circuit status."""
        return self._get_or_create_status(tool_name).model_copy()

    def get_all_statuses(self) -> Dict[str, ToolCircuitStatus]:
        """Returns instantaneous snapshot of all tool circuit statuses."""
        return {name: status.model_copy() for name, status in self._statuses.items()}
