"""ST-Care Core AI LangGraph State Machine Orchestration Package.

Provides the complete deterministic orchestration state machine:
Input Guardrail -> Cache Check -> Parallel Retrieval -> Evidence Evaluation ->
MCP Tool Node / Generation / Fallback -> Output Guardrail -> Safe Trace response.
"""

from core_ai.dependencies import get_component, register_component
from core_ai.graph.builder import build_orchestration_graph
from core_ai.graph.runner import GraphRunner, default_runner
from core_ai.graph.state import GraphState, add_execution_trace, create_initial_state


def init_graph_runner() -> GraphRunner:
    """Explicitly initializes and registers the default GraphRunner in dependency container."""
    existing = get_component("graph_runner")
    if existing is not None:
        return existing
    runner = GraphRunner()
    register_component("graph_runner", runner)
    return runner


__all__ = [
    "GraphRunner",
    "default_runner",
    "init_graph_runner",
    "GraphState",
    "create_initial_state",
    "add_execution_trace",
    "build_orchestration_graph",
]

