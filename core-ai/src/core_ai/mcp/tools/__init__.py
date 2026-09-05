"""MCP Tools module for ST-Care VNUA.

Exports definitions, schemas, and execution handlers for the 5 initial core tools:
- search_knowledge: Knowledge base retrieval.
- lookup_schedule: Student timetable/schedule lookup.
- check_tuition: Student tuition and billing check.
- get_regulations: VNUA academic policy & statute lookup.
- create_support_case: HITL escalation support ticket creation.
"""

from typing import Any, Awaitable, Callable, Dict, List, Tuple

from core_ai.contracts.mcp import ToolDefinition
from core_ai.mcp.tools.check_tuition import (
    TOOL_DEFINITION as CHECK_TUITION_DEF,
)
from core_ai.mcp.tools.check_tuition import (
    execute_check_tuition,
)
from core_ai.mcp.tools.create_support_case import (
    TOOL_DEFINITION as CREATE_SUPPORT_CASE_DEF,
)
from core_ai.mcp.tools.create_support_case import (
    execute_create_support_case,
)
from core_ai.mcp.tools.get_regulations import (
    TOOL_DEFINITION as GET_REGULATIONS_DEF,
)
from core_ai.mcp.tools.get_regulations import (
    execute_get_regulations,
)
from core_ai.mcp.tools.lookup_schedule import (
    TOOL_DEFINITION as LOOKUP_SCHEDULE_DEF,
)
from core_ai.mcp.tools.lookup_schedule import (
    execute_lookup_schedule,
)
from core_ai.mcp.tools.search_knowledge import (
    TOOL_DEFINITION as SEARCH_KNOWLEDGE_DEF,
)
from core_ai.mcp.tools.search_knowledge import (
    execute_search_knowledge,
)

CORE_TOOL_DEFINITIONS: List[ToolDefinition] = [
    SEARCH_KNOWLEDGE_DEF,
    LOOKUP_SCHEDULE_DEF,
    CHECK_TUITION_DEF,
    GET_REGULATIONS_DEF,
    CREATE_SUPPORT_CASE_DEF,
]

ToolHandler = Callable[[Dict[str, Any]], Awaitable[Dict[str, Any]]]

CORE_TOOL_HANDLERS: Dict[str, ToolHandler] = {
    "search_knowledge": execute_search_knowledge,
    "lookup_schedule": execute_lookup_schedule,
    "check_tuition": execute_check_tuition,
    "get_regulations": execute_get_regulations,
    "create_support_case": execute_create_support_case,
}


def get_core_tools() -> List[Tuple[ToolDefinition, ToolHandler]]:
    """Returns pairs of (ToolDefinition, handler) for all initial core tools."""
    return [
        (SEARCH_KNOWLEDGE_DEF, execute_search_knowledge),
        (LOOKUP_SCHEDULE_DEF, execute_lookup_schedule),
        (CHECK_TUITION_DEF, execute_check_tuition),
        (GET_REGULATIONS_DEF, execute_get_regulations),
        (CREATE_SUPPORT_CASE_DEF, execute_create_support_case),
    ]


__all__ = [
    "SEARCH_KNOWLEDGE_DEF",
    "LOOKUP_SCHEDULE_DEF",
    "CHECK_TUITION_DEF",
    "GET_REGULATIONS_DEF",
    "CREATE_SUPPORT_CASE_DEF",
    "CORE_TOOL_DEFINITIONS",
    "CORE_TOOL_HANDLERS",
    "execute_search_knowledge",
    "execute_lookup_schedule",
    "execute_check_tuition",
    "execute_get_regulations",
    "execute_create_support_case",
    "get_core_tools",
]
