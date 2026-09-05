"""Prepare one reusable query embedding and local sparse terms."""

from __future__ import annotations

import re
import time

from core_ai.dependencies import get_component
from core_ai.graph.state import GraphState, add_execution_trace

_OBVIOUS_OUT_OF_DOMAIN = re.compile(
    r"\b(?:dự báo thời tiết|nấu món|bóng đá|chứng khoán|tiền điện tử|viết code|"
    r"lập trình|xem phim|tử vi)\b",
    re.IGNORECASE,
)

_SENSITIVE_PATTERNS = re.compile(
    r"\b(?:api\s*key|secret\s*key|access\s*token|auth\s*token|system\s*prompt|"
    r"prompt\s*gốc|câu\s*lệnh\s*hệ\s*thống|mật\s*khẩu|password|mã\s*nguồn|source\s*code|"
    r"dữ\s*liệu\s*nội\s*bộ|token\s*bí\s*mật|admin\s*pass)\b",
    re.IGNORECASE,
)

_ACADEMIC_KEYWORDS = re.compile(
    r"\b(?:học phí|tín chỉ|tuyển sinh|điểm|thi|học bổng|khoa|ngành|viện|ký túc xá|"
    r"kí túc xá|nội trú|đăng ký|thực tập|tốt nghiệp|bảo lưu|chuyển trường|giáo trình|"
    r"lịch học|thời khóa biểu|bảo hiểm|học lại|cải thiện|chuẩn đầu ra|k[0-9]{2}|"
    r"vnua|nông nghiệp|sinh viên|thầy|cô|phòng đào tạo|quản lý đào tạo)\b",
    re.IGNORECASE,
)

_SOCIAL_PATTERNS = re.compile(
    r"\b(?:chào|xin chào|hello|hi|hé lô|chào bạn|chào ad|chào bot|chào em|chào anh|"
    r"chào chị|cảm ơn|cảm ơn bạn|cám ơn|thanks|thank you|bạn tên gì|tên bạn là gì|"
    r"bạn là ai|ai tạo ra bạn|bạn làm được gì|khỏe không|bạn khỏe không|hôm nay thế nào|"
    r"chúc ngày mới|tạm biệt|bye|good bye|buồn quá|vui quá|tâm sự|chán quá)\b",
    re.IGNORECASE,
)


def classify_user_intent(query: str) -> str:
    """Classifies student intention: social, sensitive, academic, or out_of_domain."""
    cleaned = query.strip().lower()

    # 1. Sensitive / overreach check
    if _SENSITIVE_PATTERNS.search(cleaned):
        return "sensitive"

    # 2. Academic check (takes priority over social greeting if question is academic)
    if _ACADEMIC_KEYWORDS.search(cleaned):
        return "academic"

    # 3. Social chit-chat / greeting
    if _SOCIAL_PATTERNS.search(cleaned):
        return "social"

    # 4. Out of domain
    if _OBVIOUS_OUT_OF_DOMAIN.search(cleaned):
        return "out_of_domain"

    # 5. Fallback short chit-chat words
    if len(cleaned) <= 20 and any(w in cleaned for w in ("chào", "hi", "hello", "ơi", "ê", "alo", "lô")):
        return "social"

    return "academic"


async def query_prep_node(state: GraphState) -> GraphState:
    started = time.perf_counter()
    state["current_stage"] = "query_prep"
    query = " ".join(state.get("message", "").split())
    state["normalized_query"] = query
    state["query_terms"] = [
        term for term in re.findall(r"[\w]+", query.lower(), flags=re.UNICODE) if len(term) > 1
    ]

    # Pre-classify user intent
    intent = classify_user_intent(query)
    state["user_intent"] = intent  # type: ignore[typeddict-item]

    # 1. Social intent -> Skip retrieval, talk naturally
    if intent == "social":
        state["topic_precheck_out"] = True
        state["is_in_domain"] = True
        add_execution_trace(
            state,
            "query_prep",
            "completed",
            int((time.perf_counter() - started) * 1000),
            {
                "intent": "social",
                "embedding_ready": False,
                "route": "social_chat",
            },
        )
        return state

    # 2. Sensitive / overreach intent -> Skip retrieval, decline politely and redirect
    if intent == "sensitive":
        state["topic_precheck_out"] = True
        state["is_in_domain"] = False
        add_execution_trace(
            state,
            "query_prep",
            "completed",
            int((time.perf_counter() - started) * 1000),
            {
                "intent": "sensitive",
                "embedding_ready": False,
                "route": "sensitive_decline",
            },
        )
        return state

    # 3. Out of domain -> Skip retrieval
    if intent == "out_of_domain":
        state["topic_precheck_out"] = True
        state["is_in_domain"] = False
        add_execution_trace(
            state,
            "query_prep",
            "completed",
            int((time.perf_counter() - started) * 1000),
            {
                "intent": "out_of_domain",
                "embedding_ready": False,
                "route": "out_of_domain",
            },
        )
        return state

    # 4. Academic intent -> Prepare embedding and proceed with retrieval
    status = "completed"
    embedding_service = get_component("embedding_service")
    if embedding_service is not None and state.get("external_calls_count", 0) < state.get(
        "max_external_calls", 2
    ):
        state["external_calls_count"] = state.get("external_calls_count", 0) + 1
        try:
            state["query_embedding"] = await embedding_service.embed_query(query)
        except Exception:
            state["query_embedding"] = []
            status = "degraded"
            state["error_code"] = "query_embedding_unavailable"
    else:
        state["query_embedding"] = []
        status = "degraded"
    add_execution_trace(
        state,
        "query_prep",
        status,  # type: ignore[arg-type]
        int((time.perf_counter() - started) * 1000),
        {
            "intent": "academic",
            "embedding_ready": bool(state["query_embedding"]),
            "terms_count": len(state["query_terms"]),
        },
    )
    return state
