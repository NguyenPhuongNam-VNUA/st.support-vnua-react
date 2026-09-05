from unittest.mock import patch

import pytest

from core_ai.graph.nodes.evidence_node import evidence_node


@pytest.mark.asyncio
async def test_evidence_formula_uses_all_five_signals(mock_settings) -> None:
    state = {
        "tenant_id": "vnua",
        "query_terms": ["học", "phí"],
        "retrieved_chunks": [
            {
                "snippet": "học phí",
                "relevance_score": 1.0,
                "freshness_score": 1.0,
                "source_trust": 1.0,
            }
        ],
        "execution_trace": [],
    }
    with patch("core_ai.config.get_settings", return_value=mock_settings):
        result = await evidence_node(state)
    assert result["evidence_score"] == 1.0
    assert result["evidence_band"] == "high"


@pytest.mark.asyncio
async def test_medium_evidence_is_not_marked_sufficient(mock_settings) -> None:
    state = {
        "tenant_id": "vnua",
        "query_terms": ["học", "phí", "học", "kỳ"],
        "retrieved_chunks": [
            {
                "snippet": "học phí học kỳ",
                "relevance_score": 0.65,
                "freshness_score": 0.6,
                "source_trust": 0.7,
            }
        ],
        "execution_trace": [],
    }
    with patch("core_ai.config.get_settings", return_value=mock_settings):
        result = await evidence_node(state)
    assert result["evidence_band"] in {"medium", "high"}
    assert result["is_sufficient_evidence"] == (result["evidence_band"] == "high")
