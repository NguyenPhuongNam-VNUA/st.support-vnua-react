from core_ai.retrieval.topic_anchors import TopicAnchorStore


def test_keyword_topics_cover_core_student_intents(tmp_path) -> None:
    store = TopicAnchorStore(tmp_path / "missing.json")
    cases = {
        "Học phí học kỳ 1 của ngành CNTT": "tuition",
        "Cho mình xem lịch học môn Toán": "schedule",
        "Quy chế đăng ký tín chỉ": "regulations",
        "Điểm chuẩn tuyển sinh năm 2026": "admissions",
    }
    for query, expected in cases.items():
        topic, score, _ = store.score(query, [])
        assert topic == expected
        assert score > 0


def test_unrelated_query_has_no_topic(tmp_path) -> None:
    assert TopicAnchorStore(tmp_path / "missing.json").score("nấu món canh", [])[:2] == (
        None,
        0.0,
    )
