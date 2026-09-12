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
    intent = state.get("user_intent", "academic")
    q_lower = query.lower()

    # 1. Guardrail Blocked (Prompt injection, PII, oversize)
    if state.get("is_blocked") or reason in (
        "guardrail_blocked",
        "prompt_injection_detected",
        "pii_detected",
        "prompt_guard_model_blocked",
    ):
        state["status"] = RouteStatus.BLOCKED
        category = state.get("block_category", "")

        if category == "empty_payload":
            answer = "Câu hỏi của bạn đang để trống. Bạn hãy nhập nội dung cần hỗ trợ nhé!"
        elif category == "payload_too_large":
            answer = "Câu hỏi của bạn vượt quá độ dài cho phép (4000 ký tự). Bạn vui lòng tóm tắt ngắn gọn lại để mình hỗ trợ chuẩn xác nhất nhé!"
        elif category in ("pii_violation", "pii_detected"):
            answer = "Để bảo đảm an toàn thông tin cá nhân, hệ thống không tiếp nhận các nội dung chứa dữ liệu nhạy cảm (như mật khẩu, CCCD, thông tin tài khoản). Bạn hãy đặt câu hỏi mà không kèm các thông tin này nhé!"
        else:
            answer = "Yêu cầu này chưa phù hợp với quy chuẩn sử dụng hoặc vượt quá phạm vi hỗ trợ của hệ thống. Bạn vui lòng đặt lại câu hỏi liên quan đến học tập hoặc quy chế đào tạo tại VNUA nhé! 😊"

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
        answer = f"Mình đã ẩn thông tin cá nhân trong câu hỏi: > {preview}\nNếu đúng ý bạn, hãy xác nhận để tiếp tục nhé!"
        state["fallback"] = FallbackInfo(
            reason="redaction_confirmation_required",
            original_route="input_guardrail",
            fallback_strategy="redact_confirm",
            redacted_query=preview,
        )

    # 2. Social intent
    elif intent == "social":
        state["status"] = RouteStatus.ANSWERED
        if any(w in q_lower for w in ("cảm ơn", "thank", "tks", "cam on")):
            answer = "Không có chi nè! Mình rất vui được hỗ trợ bạn 😊. Nếu có thắc mắc gì thêm về học tập hay đời sống ở trường, bạn cứ nhắn mình nhé!"
        elif any(w in q_lower for w in ("tên", "là ai", "giới thiệu")):
            answer = "Chào bạn! Mình là ST - Care, trợ lý đồng hành cùng sinh viên Học viện Nông nghiệp Việt Nam (VNUA) 😊. Bạn cần mình giải đáp gì về học tập, học phí hay ký túc xá không nè?"
        elif any(w in q_lower for w in ("tạm biệt", "bye", "chúc ngủ ngon")):
            answer = "Tạm biệt bạn nhé! Chúc bạn một ngày học tập thật hiệu quả và nhiều niềm vui ✨."
        else:
            answer = "Chào bạn nè! Mình là ST - Care đây 😊. Hôm nay bạn cần mình hỗ trợ gì về học tập hay sinh hoạt ở Học viện Nông nghiệp Việt Nam không?"

    # 3. Sensitive / overreach intent
    elif intent == "sensitive":
        state["status"] = RouteStatus.BLOCKED
        answer = "Khoản này thuộc về thông tin kỹ thuật và dữ liệu bảo mật nội bộ của hệ thống nên mình không thể chia sẻ được bạn nha 😊. Mình luôn sẵn sàng giải đáp về quy chế, học phí, lịch học hay đời sống tại VNUA — bạn cần mình hỗ trợ gì không nè?"

    # 4. Call Budget Ceiling Exceeded
    elif reason == "budget_exceeded":
        state["status"] = RouteStatus.DEGRADED
        answer = "Hiện tại hệ thống đang tiếp nhận nhiều câu hỏi cùng lúc. Bạn đợi một lát rồi thử lại với mình nhé!"

    # 5. Out of domain
    elif reason == "out_of_domain" or state.get("topic_precheck_out", False) or intent == "out_of_domain":
        state["status"] = RouteStatus.REDIRECTED
        answer = "Mình chuyên hỗ trợ về học tập, học phí, quy chế đào tạo và đời sống tại Học viện Nông nghiệp Việt Nam (VNUA) 😊. Bạn cần hỏi gì về trường mình không nè?"

    # 6. Weak / Insufficient Grounding Evidence (Apply the 3-step rule: a - b - c)
    elif not state.get("is_sufficient_evidence", True) or reason in (
        "low_evidence_confidence",
        "insufficient_evidence",
    ):
        state["status"] = RouteStatus.CLARIFIED
        state["retrieved_chunks"] = []
        state["citations"] = []
        inferred_topic = ""
        narrow_question = "Bạn đang hỏi cho sinh viên khóa K mấy hoặc thuộc ngành/khoa nào để mình tra cứu chuẩn nhất nhé? 😊"

        if "học phí" in q_lower or "công nợ" in q_lower:
            inferred_topic = "Có thể bạn đang cần tra cứu mức thu học phí theo tín chỉ hoặc biểu phí của năm học mới."
            narrow_question = "Bạn cho mình biết bạn thuộc khóa K mấy và ngành nào để mình xem biểu phí chính xác nha? 😊"
        elif "ký túc xá" in q_lower or "kí túc xá" in q_lower or "phòng ở" in q_lower:
            inferred_topic = "Có thể bạn đang tìm hiểu thủ tục đăng ký phòng ở KTX hoặc chi phí điện nước dịch vụ."
            narrow_question = "Bạn là tân sinh viên hay sinh viên đang theo học, và bạn quan tâm đến khu nhà KTX nào nhỉ? 😊"
        elif "học bổng" in q_lower:
            inferred_topic = "Có thể bạn đang tìm hiểu tiêu chuẩn xét học bổng khuyến khích học tập hoặc học bổng doanh nghiệp."
            narrow_question = "Bạn đang quan tâm đến đợt xét học bổng học kỳ này của khoa nào vậy nè? 😊"
        elif "tín chỉ" in q_lower or "đăng ký học" in q_lower:
            inferred_topic = "Có thể bạn đang cần thông tin về lịch đăng ký tín chỉ bổ sung hoặc số tín chỉ tối thiểu mỗi kỳ."
            narrow_question = "Bạn đang học chương trình tiêu chuẩn hay định hướng nghề nghiệp (POHE) để mình kiểm tra nhé? 😊"
        elif "tốt nghiệp" in q_lower or "chuẩn đầu ra" in q_lower:
            inferred_topic = "Có thể bạn đang quan tâm đến điều kiện chuẩn đầu ra ngoại ngữ, tin học hoặc hồ sơ xét tốt nghiệp."
            narrow_question = "Bạn là sinh viên khóa K mấy để mình đối chiếu khung chuẩn đầu ra tương ứng nha? 😊"
        else:
            inferred_topic = "Có thể bạn đang tìm hiểu các quy định hoặc thông báo mới nhất từ Ban Quản lý Đào tạo."

        answer = f"Hiện tại mình chưa có thông tin chính xác về nội dung này trong các văn bản quy chế hiện hành. {inferred_topic} {narrow_question}"
        state["fallback"] = FallbackInfo(
            reason="low_evidence_confidence",
            original_route="evidence_eval",
            fallback_strategy="clarify_prompt",
            contact_channel=VNUA_STAFF_CONTACT,
        )

    # 7. Default
    else:
        state["status"] = RouteStatus.DEGRADED
        answer = "Mình đang cập nhật thêm dữ liệu về câu hỏi này. Bạn chia sẻ thêm một chút chi tiết (như khóa K hoặc ngành) để mình hỗ trợ chuẩn hơn nhé! 😊"

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
