from unittest.mock import MagicMock, patch

import pytest

from core_ai.graph.nodes.fallback_node import fallback_node
from core_ai.graph.nodes.generation_node import generation_node
from core_ai.graph.routing import (
    route_after_evidence,
    route_after_query_prep,
    route_after_topic,
)
from core_ai.graph.state import create_initial_state


def test_routes_only_usable_evidence_to_generation() -> None:
    assert route_after_evidence(
        {
            "evidence_band": "medium",
            "retrieval_attempts": 1,
            "retrieved_chunks": [{"source_type": "faq"}],
        }
    ) == "retrieval"
    assert route_after_evidence(
        {
            "evidence_band": "medium",
            "retrieval_attempts": 2,
            "retrieved_chunks": [{"source_type": "document"}],
        }
    ) == "generation"
    assert route_after_evidence(
        {
            "evidence_band": "low",
            "retrieval_attempts": 2,
            "retrieved_chunks": [{"source_type": "document"}],
        }
    ) == "fallback"
    assert route_after_evidence(
        {
            "evidence_band": "high",
            "is_sufficient_evidence": True,
            "has_distinctive_match": False,
            "retrieval_attempts": 2,
            "retrieved_chunks": [{"source_type": "document"}],
        }
    ) == "fallback"


def test_non_academic_routes_do_not_generate_factual_answers() -> None:
    assert route_after_query_prep(
        {"topic_precheck_out": True, "user_intent": "social"}
    ) == "generation"
    assert route_after_query_prep(
        {"topic_precheck_out": True, "user_intent": "out_of_domain"}
    ) == "fallback"
    assert route_after_topic({"is_in_domain": False}) == "fallback"


@pytest.mark.asyncio
async def test_generation_skips_llm_without_academic_evidence() -> None:
    state = create_initial_state("req-no-evidence", "Mức hỗ trợ là bao nhiêu?")
    state["user_intent"] = "academic"
    llm_port = MagicMock()

    with patch(
        "core_ai.graph.nodes.generation_node.get_component", return_value=llm_port
    ):
        result = await generation_node(state)

    assert result["answer"] == ""
    assert result["fallback"].reason == "insufficient_evidence"
    assert result["external_calls_count"] == 0
    assert not llm_port.mock_calls


@pytest.mark.asyncio
async def test_insufficient_fallback_is_deterministic_and_has_no_sources() -> None:
    state = create_initial_state("req-refuse", "Một quy định chưa có trong dữ liệu")
    state["user_intent"] = "academic"
    state["retrieved_chunks"] = [{"source_type": "document"}]
    state["citations"] = [MagicMock()]

    result = await fallback_node(state)

    assert "chưa có thông tin chính xác" in result["answer"]
    assert result["retrieved_chunks"] == []
    assert result["citations"] == []
    assert result["external_calls_count"] == 0
