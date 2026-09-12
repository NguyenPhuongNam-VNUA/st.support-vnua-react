from core_ai.graph.builder import build_orchestration_graph


def test_academic_pipeline_validates_topic_before_embedding() -> None:
    edges = {
        (edge.source, edge.target)
        for edge in build_orchestration_graph().get_graph().edges
    }

    assert ("input_guardrail", "query_prep") in edges
    assert ("query_prep", "topic_scoring") in edges
    assert ("topic_scoring", "cache_check") in edges
    assert ("cache_check", "embedding") in edges
    assert ("embedding", "semantic_cache") in edges
    assert ("semantic_cache", "retrieval") in edges
