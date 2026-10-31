"""MCP Tools module for ST-Care VNUA.

Exports definitions, schemas, and execution handlers for the core tools:
- search_knowledge: Knowledge base retrieval.
- get_regulations: VNUA academic policy & statute lookup.
"""

from typing import Any, Awaitable, Callable, Dict, List, Tuple

from core_ai.contracts.mcp import ToolDefinition
from core_ai.mcp.tools.get_regulations import (
    TOOL_DEFINITION as GET_REGULATIONS_DEF,
)
from core_ai.mcp.tools.get_regulations import (
    execute_get_regulations,
)
from core_ai.mcp.tools.search_knowledge import (
    TOOL_DEFINITION as SEARCH_KNOWLEDGE_DEF,
)
from core_ai.mcp.tools.search_knowledge import (
    execute_search_knowledge,
)

CORE_TOOL_DEFINITIONS: List[ToolDefinition] = [
    SEARCH_KNOWLEDGE_DEF,
    GET_REGULATIONS_DEF,
]

ToolHandler = Callable[[Dict[str, Any]], Awaitable[Dict[str, Any]]]

CORE_TOOL_HANDLERS: Dict[str, ToolHandler] = {
    "search_knowledge": execute_search_knowledge,
    "get_regulations": execute_get_regulations,
}


def get_core_tools() -> List[Tuple[ToolDefinition, ToolHandler]]:
    """Returns pairs of (ToolDefinition, handler) for all core tools."""
    return [
        (SEARCH_KNOWLEDGE_DEF, execute_search_knowledge),
        (GET_REGULATIONS_DEF, execute_get_regulations),
    ]


__all__ = [
    "SEARCH_KNOWLEDGE_DEF",
    "GET_REGULATIONS_DEF",
    "CORE_TOOL_DEFINITIONS",
    "CORE_TOOL_HANDLERS",
    "execute_search_knowledge",
    "execute_get_regulations",
    "get_core_tools",
]
