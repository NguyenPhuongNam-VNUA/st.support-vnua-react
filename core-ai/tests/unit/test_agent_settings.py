from contextlib import asynccontextmanager
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from core_ai.agent_settings import clear_agent_settings_cache, get_agent_settings
from core_ai.config import get_settings


def _fake_connection(row):
    conn = MagicMock()
    conn.fetchrow = AsyncMock(return_value=row)

    @asynccontextmanager
    async def factory(tenant_id=None):
        yield conn

    return factory


@pytest.fixture(autouse=True)
def _clear_cache():
    clear_agent_settings_cache()
    yield
    clear_agent_settings_cache()


@pytest.mark.asyncio
async def test_overrides_merge_with_env_defaults() -> None:
    env = get_settings()
    row = {
        "system_prompt": "  Bạn là trợ lý VNUA.  ",
        "llm_model": None,
        "temperature": Decimal("0.10"),
        "evidence_low_threshold": Decimal("0.75"),
    }
    with patch("core_ai.data.postgres.get_db_connection", _fake_connection(row)):
        result = await get_agent_settings("vnua")

    assert result.system_prompt == "Bạn là trợ lý VNUA."
    assert result.llm_model == env.llm_model
    assert result.temperature == 0.1
    # Clamped below the high band so medium evidence still exists.
    assert result.evidence_low_threshold == min(0.75, env.evidence_high_threshold - 0.01)


@pytest.mark.asyncio
async def test_missing_table_falls_back_to_env() -> None:
    @asynccontextmanager
    async def broken(tenant_id=None):
        raise RuntimeError('relation "agent_settings" does not exist')
        yield

    env = get_settings()
    with patch("core_ai.data.postgres.get_db_connection", broken):
        result = await get_agent_settings("vnua")

    assert result.system_prompt is None
    assert result.llm_model == env.llm_model
    assert result.temperature == env.llm_temperature
    assert result.evidence_low_threshold == env.evidence_low_threshold
