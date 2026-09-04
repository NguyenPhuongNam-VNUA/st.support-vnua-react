"""Graph builder constructing the LangGraph state machine for ST-Care Core AI.

Builds the complete state machine coordinating:
Input Guardrail -> Cache Check -> Parallel Retrieval -> Evidence Evaluation ->
MCP Tool Node / Fallback / Generation -> Output Guardrail -> Safe Trace.

Uses the official LangGraph StateGraph runtime.
"""

from __future__ import annotations

import logging
from typing import Any

from langgraph.graph import END, START, StateGraph

from core_ai.graph.nodes import (
    cache_node,
    evidence_node,
    fallback_node,
    generation_node,
    input_guardrail_node,
    output_guardrail_node,
    retrieval_node,
    tool_node,
)
from core_ai.graph.routing import (
    route_after_cache,
    route_after_evidence,
    route_after_generation,
    route_after_input_guardrail,
    route_after_tool,
)
from core_ai.graph.state import GraphState

logger = logging.getLogger("core_ai.graph.builder")

def build_orchestration_graph() -> Any:
    """Constructs and compiles the official LangGraph state machine."""
    builder = StateGraph(GraphState)
    logger.info("Using official LangGraph StateGraph engine.")

    # 1. Register Nodes
    builder.add_node("input_guardrail", input_guardrail_node)
    builder.add_node("cache_check", cache_node)
    builder.add_node("retrieval", retrieval_node)
    builder.add_node("evidence_eval", evidence_node)
    builder.add_node("tool_node", tool_node)
    builder.add_node("generation", generation_node)
    builder.add_node("fallback", fallback_node)
    builder.add_node("output_guardrail", output_guardrail_node)

    # 2. Register Edges
    # START -> input_guardrail
    builder.add_edge(START, "input_guardrail")

    # input_guardrail -> cache_check OR fallback
    builder.add_conditional_edges(
        "input_guardrail",
        route_after_input_guardrail,
        {"cache_check": "cache_check", "tool_node": "tool_node", "fallback": "fallback"},
    )

    # cache_check -> output_guardrail (cache hit) OR retrieval (cache miss)
    builder.add_conditional_edges(
        "cache_check",
        route_after_cache,
        {"output_guardrail": "output_guardrail", "retrieval": "retrieval"},
    )

    # retrieval -> evidence_eval
    builder.add_edge("retrieval", "evidence_eval")

    # evidence_eval -> generation OR retrieval (corrective retry) OR tool_node OR fallback
    builder.add_conditional_edges(
        "evidence_eval",
        route_after_evidence,
        {
            "generation": "generation",
            "retrieval": "retrieval",
            "tool_node": "tool_node",
            "fallback": "fallback",
        },
    )

    # tool_node -> generation OR fallback
    builder.add_conditional_edges(
        "tool_node",
        route_after_tool,
        {
            "generation": "generation",
            "output_guardrail": "output_guardrail",
            "fallback": "fallback",
        },
    )

    # generation -> output_guardrail OR fallback
    builder.add_conditional_edges(
        "generation",
        route_after_generation,
        {"output_guardrail": "output_guardrail", "fallback": "fallback"},
    )

    # fallback -> output_guardrail
    builder.add_edge("fallback", "output_guardrail")

    # output_guardrail -> END
    builder.add_edge("output_guardrail", END)

    compiled = builder.compile()
    logger.info("LangGraph orchestration graph compiled successfully.")
    return compiled
