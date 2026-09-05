"""Fallback and Human-in-the-Loop (HITL) node for LangGraph orchestration.

Handles safe degraded responses, clarification questions for ambiguous queries,
policy-blocked notifications, and escalation routing to human staff.
"""

from __future__ import annotations

import logging
import time

from core_ai.contracts.chat import FallbackInfo, RouteStatus
from core_ai.graph.state import GraphState, add_execution_trace
from core_ai.observability.metrics import record_fallback

logger = logging.getLogger("core_ai.graph.nodes.fallback_node")

VNUA_STAFF_CONTACT = (
    "Ban Quản lý Đào tạo - Học viện Nông nghiệp Việt Nam\n"
    "- Địa chỉ: Tòa nhà Trung tâm, TT Trâu Quỳ, Gia Lâm, Hà Nội\n"
    "- Email: phongdaotao@vnua.edu.vn\n"
    "- Hotline hỗ trợ: 024.6261.7586 | Cổng thông tin: https://daotao.vnua.edu.vn"
)


async def fallback_node(state: GraphState) -> GraphState:
    """Constructs safe, student-friendly fallback or HITL clarification answer."""
    t0 = time.perf_counter()
    state["current_stage"] = "fallback"

    fb_info = state.get("fallback")
    reason = fb_info.reason if fb_info else "unspecified"
    query = state.get("message", "")

    # 1. Guardrail Blocked (Prompt injection, PII, oversize)
    if state.get("is_blocked") or reason in (
        "guardrail_blocked",
        "prompt_injection_detected",
        "pii_detected",
    ):
        state["status"] = RouteStatus.BLOCKED
        block_msg = (
            state.get("block_reason")
            or "Yêu cầu không thể xử lý do vi phạm chính sách an toàn thông tin."
        )
        answer = (
            f"Thông báo từ hệ thống trợ lý ST-Care VNUA:\n{block_msg}\n\n"
            "Vui lòng đặt câu hỏi liên quan đến chương trình học tập, học phí "
            "hoặc quy chế của Học viện."
        )
        if not fb_info:
            state["fallback"] = FallbackInfo(
                reason="guardrail_blocked",
                original_route="input_guardrail",
                fallback_strategy="safe_template",
                contact_channel=VNUA_STAFF_CONTACT,
            )

    elif reason == "redaction_confirmation_required":
        state["status"] = RouteStatus.CLARIFIED
        preview = state.get("sanitized_preview") or "[NỘI DUNG ĐÃ ĐƯỢC ẨN]"
        answer = (
            "Mình đã phát hiện và che thông tin cá nhân trong câu hỏi. "
            "Nếu nội dung dưới đây vẫn đúng ý bạn, hãy xác nhận để tiếp tục:\n\n"
            f"> {preview}"
        )
        state["fallback"] = FallbackInfo(
            reason="redaction_confirmation_required",
            original_route="input_guardrail",
            fallback_strategy="redact_confirm",
            redacted_query=preview,
        )

    # 2. Call Budget Ceiling Exceeded
    elif reason == "budget_exceeded":
        state["status"] = RouteStatus.DEGRADED
        answer = (
            "Hệ thống trợ lý ST-Care VNUA hiện đang tiếp nhận lượng lớn yêu cầu "
            "và đã đạt ngưỡng xử lý cho phiên này. "
            "Để được hỗ trợ nhanh nhất, sinh viên vui lòng tra cứu trực tiếp tại "
            "cổng đào tạo hoặc liên hệ bộ phận hỗ trợ:\n\n"
            f"{VNUA_STAFF_CONTACT}"
        )
        if not fb_info:
            state["fallback"] = FallbackInfo(
                reason="budget_exceeded",
                original_route="generation",
                fallback_strategy="safe_template",
                contact_channel=VNUA_STAFF_CONTACT,
            )

    # 3. Explicit support action could not be completed
    elif reason == "tool_unavailable":
        state["status"] = RouteStatus.DEGRADED
        answer = (
            "Chưa thể tạo phiếu hỗ trợ vào lúc này. Hệ thống không ghi nhận phiếu giả. "
            "Bạn vui lòng thử lại hoặc liên hệ trực tiếp:\n\n"
            f"{VNUA_STAFF_CONTACT}"
        )

    elif reason == "out_of_domain" or state.get("topic_precheck_out", False):
        state["status"] = RouteStatus.REDIRECTED
        answer = (
            "Mình phù hợp nhất với các câu hỏi về học tập, học phí, lịch học, tuyển sinh "
            "và quy chế của Học viện. Bạn thử đặt lại câu hỏi theo một trong các chủ đề đó nhé."
        )

    elif reason == "clarification_required":
        state["status"] = RouteStatus.CLARIFIED
        answer = (
            state.get("clarification_question")
            or "Bạn vui lòng bổ sung thêm thông tin để mình tra cứu chính xác."
        )

    # 4. Weak / Insufficient Grounding Evidence (Clarify / HITL)
    elif not state.get("is_sufficient_evidence", True) or reason in (
        "low_evidence_confidence",
        "insufficient_evidence",
    ):
        state["status"] = RouteStatus.CLARIFIED
        answer = (
            f"Trợ lý ST-Care chưa tìm thấy tài liệu quy chế cụ thể về yêu cầu: '{query}'.\n\n"
            "Để có câu trả lời chính xác, bạn vui lòng làm rõ thêm:\n"
            "- Tên khoa / ngành học cụ thể của bạn?\n"
            "- Khóa đào tạo (K-năm) hoặc học kỳ bạn đang cần tra cứu?\n\n"
            f"Hoặc liên hệ trực tiếp với chúng tôi:\n{VNUA_STAFF_CONTACT}"
        )
        state["fallback"] = FallbackInfo(
            reason="low_evidence_confidence",
            original_route="evidence_eval",
            fallback_strategy="clarify_prompt",
            contact_channel=VNUA_STAFF_CONTACT,
        )

    # 5. Provider Unavailable or Timeout
    else:
        state["status"] = RouteStatus.DEGRADED
        answer = (
            "Dịch vụ AI hiện đang bảo trì hoặc phản hồi quá thời gian cho phép. "
            "Thông tin học tập và quy chế chính thức luôn được cập nhật đầy đủ tại:\n\n"
            f"{VNUA_STAFF_CONTACT}"
        )
        if not fb_info:
            state["fallback"] = FallbackInfo(
                reason="provider_unavailable",
                original_route="generation",
                fallback_strategy="safe_template",
                contact_channel=VNUA_STAFF_CONTACT,
            )

    state["answer"] = answer
    state["confidence"] = (
        0.0
        if state["status"] in (RouteStatus.BLOCKED, RouteStatus.REDIRECTED)
        else min(0.5, float(state.get("evidence_score", 0.5)))
    )
    fallback = state.get("fallback")
    record_fallback(
        reason=fallback.reason if fallback else reason,
        strategy=fallback.fallback_strategy if fallback else "safe_template",
    )

    latency = int((time.perf_counter() - t0) * 1000)
    add_execution_trace(
        state,
        "fallback",
        "completed",
        latency,
        {"reason": reason, "status": state["status"].value},
    )
    return state
