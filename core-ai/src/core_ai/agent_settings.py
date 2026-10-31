"""Admin-editable agent settings stored in public.agent_settings.

NULL columns (or a missing row/table) fall back to the environment Settings, so
the agent keeps working when the database is unreachable.
"""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass
from typing import Dict, Optional, Tuple

from core_ai.config import get_settings

logger = logging.getLogger("core_ai.agent_settings")

_CACHE_TTL_SECONDS = 15.0
_cache: Dict[str, Tuple[float, "AgentSettings"]] = {}


@dataclass(frozen=True)
class AgentSettings:
    system_prompt: Optional[str]  # None = built-in prompt in generation_node
    llm_model: str
    temperature: float
    evidence_low_threshold: float


def _defaults() -> AgentSettings:
    settings = get_settings()
    return AgentSettings(
        system_prompt=None,
        llm_model=settings.llm_model,
        temperature=settings.llm_temperature,
        evidence_low_threshold=settings.evidence_low_threshold,
    )


async def get_agent_settings(tenant_id: str) -> AgentSettings:
    """Return merged settings, cached briefly so each chat turn avoids a DB query."""
    now = time.monotonic()
    cached = _cache.get(tenant_id)
    if cached and now - cached[0] < _CACHE_TTL_SECONDS:
        return cached[1]

    defaults = _defaults()
    result = defaults
    try:
        from core_ai.data.postgres import get_db_connection

        async with get_db_connection(tenant_id=tenant_id) as conn:
            row = await conn.fetchrow(
                "SELECT system_prompt, llm_model, temperature, evidence_low_threshold "
                "FROM public.agent_settings WHERE tenant_id = $1",
                tenant_id,
            )
        if row:
            high = get_settings().evidence_high_threshold
            low = row["evidence_low_threshold"]
            result = AgentSettings(
                system_prompt=(row["system_prompt"] or "").strip() or None,
                llm_model=row["llm_model"] or defaults.llm_model,
                temperature=(
                    float(row["temperature"]) if row["temperature"] is not None else defaults.temperature
                ),
                # Must stay below the high band or the "medium evidence" band disappears.
                evidence_low_threshold=(
                    min(float(low), high - 0.01) if low is not None else defaults.evidence_low_threshold
                ),
            )
    except Exception as exc:  # missing table, DB down: keep env defaults
        logger.warning("Agent settings unavailable, using env defaults: %s", exc)

    _cache[tenant_id] = (now, result)
    return result


def clear_agent_settings_cache() -> None:
    _cache.clear()
