"""Unit tests for RAM-based SessionMemoryStore with 48h TTL and zero-cost heuristics."""

import time
from core_ai.data.memory_store import SessionMemoryStore


def test_session_memory_store_lifecycle() -> None:
    store = SessionMemoryStore(ttl_seconds=3600 * 48)

    # 1. Record turn with student profile heuristics
    store.record_turn(
        session_key="192.168.1.50",
        user_message="Chào bạn, mình là sinh viên K68 ngành Công nghệ thông tin.",
        assistant_message="Chào bạn sinh viên K68 CNTT! Mình có thể hỗ trợ gì cho bạn hôm nay?",
    )

    session = store.get_or_create("192.168.1.50")
    assert session.profile.get("cohort_k") == "K68"
    assert "công nghệ thông tin" in session.profile.get("major", "").lower()
    assert len(session.turns) == 2

    # 2. Get personalization context
    context = store.get_personalization_context("192.168.1.50")
    assert "K68" in context
    assert "công nghệ thông tin" in context.lower()

    # 3. Second turn updates topics without overwriting profile
    store.record_turn(
        session_key="192.168.1.50",
        user_message="Học phí kỳ 1 của mình là bao nhiêu?",
        assistant_message="Học phí kỳ 1 ngành CNTT K68 khoảng 350.000đ/tín chỉ.",
    )

    session2 = store.get_or_create("192.168.1.50")
    assert "Học phí & Công nợ" in session2.topics
    assert len(session2.turns) == 4

    # 4. TTL Expiry check
    short_ttl_store = SessionMemoryStore(ttl_seconds=0.1)
    short_ttl_store.record_turn("10.0.0.1", "Alo", "Chào bạn")
    assert "10.0.0.1" in short_ttl_store._sessions

    time.sleep(0.15)
    # Getting expired session resets it
    new_session = short_ttl_store.get_or_create("10.0.0.1")
    assert len(new_session.turns) == 0
