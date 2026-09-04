"""MCP Tests for 3-State Tool Circuit Breaker.

Tests:
1. Initial state: CLOSED allows executions.
2. State transition: CLOSED -> OPEN after consecutive failures reach threshold (default 3).
3. Fast-fail behavior when OPEN (rejects execution immediately).
4. State transition: OPEN -> HALF_OPEN after recovery timeout elapsed.
5. Recovery transition: HALF_OPEN -> CLOSED after required consecutive successes (default 2).
6. Relapse transition: HALF_OPEN -> OPEN immediately upon single canary failure.
"""

import time
import pytest

from core_ai.contracts.mcp import CircuitBreakerConfig, CircuitBreakerState
from core_ai.mcp.circuit_breaker import ToolCircuitBreaker


@pytest.fixture
def circuit_breaker() -> ToolCircuitBreaker:
    config = CircuitBreakerConfig(
        failure_threshold=3,
        recovery_timeout_seconds=0.1,  # Fast timeout for test speed
        half_open_success_threshold=2,
    )
    return ToolCircuitBreaker(config)


class TestCircuitBreaker:
    @pytest.mark.asyncio
    async def test_initial_state_closed(self, circuit_breaker: ToolCircuitBreaker) -> None:
        """New tool starts in CLOSED state and permits calls."""
        tool = "search_knowledge"
        assert await circuit_breaker.can_execute(tool) is True
        status = circuit_breaker.get_status(tool)
        assert status.state == CircuitBreakerState.CLOSED

    @pytest.mark.asyncio
    async def test_trips_to_open_after_threshold_failures(
        self, circuit_breaker: ToolCircuitBreaker
    ) -> None:
        """Circuit transitions from CLOSED to OPEN after 3 consecutive failures."""
        tool = "lookup_schedule"

        await circuit_breaker.record_failure(tool, Exception("Timeout 1"))
        assert await circuit_breaker.can_execute(tool) is True

        await circuit_breaker.record_failure(tool, Exception("Timeout 2"))
        assert await circuit_breaker.can_execute(tool) is True

        # 3rd failure reaches threshold
        await circuit_breaker.record_failure(tool, Exception("Timeout 3"))

        # Now circuit must be OPEN
        status = circuit_breaker.get_status(tool)
        assert status.state == CircuitBreakerState.OPEN
        assert await circuit_breaker.can_execute(tool) is False

    @pytest.mark.asyncio
    async def test_open_to_half_open_after_timeout(
        self, circuit_breaker: ToolCircuitBreaker
    ) -> None:
        """After recovery timeout elapses, can_execute transitions circuit to HALF_OPEN for canary probe."""
        tool = "check_tuition"
        # Trip to OPEN
        for _ in range(3):
            await circuit_breaker.record_failure(tool, Exception("Err"))

        assert circuit_breaker.get_status(tool).state == CircuitBreakerState.OPEN

        # Wait for recovery timeout (0.1s)
        time.sleep(0.12)

        # First call after timeout transitions to HALF_OPEN and returns True
        can_run = await circuit_breaker.can_execute(tool)
        assert can_run is True

        status = circuit_breaker.get_status(tool)
        assert status.state == CircuitBreakerState.HALF_OPEN

    @pytest.mark.asyncio
    async def test_half_open_to_closed_on_successes(
        self, circuit_breaker: ToolCircuitBreaker
    ) -> None:
        """Two consecutive successes in HALF_OPEN close the circuit breaker."""
        tool = "get_regulations"
        for _ in range(3):
            await circuit_breaker.record_failure(tool, Exception("Err"))

        time.sleep(0.12)
        await circuit_breaker.can_execute(tool)  # enters HALF_OPEN

        # Record 2 consecutive successes
        await circuit_breaker.record_success(tool)
        await circuit_breaker.record_success(tool)

        status = circuit_breaker.get_status(tool)
        assert status.state == CircuitBreakerState.CLOSED

    @pytest.mark.asyncio
    async def test_half_open_relapses_to_open_on_single_failure(
        self, circuit_breaker: ToolCircuitBreaker
    ) -> None:
        """A failure during canary probe in HALF_OPEN immediately trips back to OPEN."""
        tool = "create_support_case"
        for _ in range(3):
            await circuit_breaker.record_failure(tool, Exception("Err"))

        time.sleep(0.12)
        await circuit_breaker.can_execute(tool)  # enters HALF_OPEN

        # Canary fails
        await circuit_breaker.record_failure(tool, Exception("Canary failed"))

        status = circuit_breaker.get_status(tool)
        assert status.state == CircuitBreakerState.OPEN
