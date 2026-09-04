"""Guardrail nodes for input validation and output safety in LangGraph.

Implements:
1. input_guardrail_node: Unicode normalization, size check (1-4000 chars),
   prompt injection pattern detection, and PII filtering.
2. output_guardrail_node: 100% citation whitelist validation against retrieved chunks,
   HTML/XSS sanitization, and PII masking before answer delivery.
"""

from __future__ import annotations

import re
import time
import unicodedata
from typing import Any, Dict, List, Set

from core_ai.contracts.chat import Citation, FallbackInfo, RouteStatus
from core_ai.dependencies import get_component
from core_ai.graph.state import GraphState, add_execution_trace
from core_ai.guardrails.pii_filter import PIIFilter
from core_ai.observability.metrics import record_fallback

# Regular expressions for prompt injection heuristics
INJECTION_PATTERNS = [
    re.compile(r"ignore\s+(previous|all|the)\s+(instructions|prompts|rules)", re.IGNORECASE),
    re.compile(r"(disregard|forget)\s+(prior|previous)\s+instructions", re.IGNORECASE),
    re.compile(r"system\s+prompt\s*(override|leak|reveal|show)", re.IGNORECASE),
    re.compile(r"you\s+are\s+now\s+(DAN|unrestricted|jailbroken|an\s+ai\s+without\s+rules)", re.IGNORECASE),
    re.compile(r"```\s*(system|admin|internal)", re.IGNORECASE),
    re.compile(r"<\|\s*(system|im_start|im_end)\s*\|>", re.IGNORECASE),
    re.compile(r"bỏ\s+qua\s+(toàn\s+bộ\s+)?(hướng\s+dẫn|quy\s+tắc|chỉ\s+thị)", re.IGNORECASE),
    re.compile(r"(tiết\s+lộ|cho\s+biết|in\s+ra)\s+(prompt\s+hệ\s+thống|system\s+prompt)", re.IGNORECASE),
]

# Sensitive PII patterns (Credit card, Vietnamese CCCD 12 digits, password fields)
PII_PATTERNS = [
    re.compile(r"\b(?:\d[ -]*?){13,16}\b"),  # Credit card (13-16 digits)
    re.compile(r"\b0\d{11}\b"),  # Vietnamese CCCD (12 digits starting with 0)
    re.compile(r"(?:mật\s+khẩu|password)\s*[:=]\s*\S+", re.IGNORECASE),
]

# Malicious HTML/XSS patterns
XSS_PATTERNS = [
    re.compile(r"<\s*script[^>]*>.*?<\s*/\s*script\s*>", re.IGNORECASE | re.DOTALL),
    re.compile(r"<\s*iframe[^>]*>.*?<\s*/\s*iframe\s*>", re.IGNORECASE | re.DOTALL),
    re.compile(r"<\s*embed[^>]*>.*?<\s*/\s*embed\s*>", re.IGNORECASE | re.DOTALL),
    re.compile(r"<\s*object[^>]*>.*?<\s*/\s*object\s*>", re.IGNORECASE | re.DOTALL),
    re.compile(r"javascript\s*:", re.IGNORECASE),
    re.compile(r"on\w+\s*=", re.IGNORECASE),  # onload=, onerror=, etc.
]


async def input_guardrail_node(state: GraphState) -> GraphState:
    """Validates input payload size, detects prompt injection, and checks PII."""
    t0 = time.perf_counter()
    state["current_stage"] = "input_guardrail"
    message = state.get("message", "")

    # 1. Unicode NFC Normalization
    normalized = unicodedata.normalize("NFC", message).strip()
    state["message"] = normalized

    # 2. Payload size bounds check
    if len(normalized) == 0:
        latency = int((time.perf_counter() - t0) * 1000)
        state["is_blocked"] = True
        state["block_reason"] = "Câu hỏi không được để trống"
        state["block_category"] = "empty_payload"
        state["status"] = RouteStatus.BLOCKED
        state["fallback"] = FallbackInfo(
            reason="empty_payload",
            original_route="input_guardrail",
            fallback_strategy="safe_template",
            contact_channel="Ban Quản lý Đào tạo VNUA: phongdaotao@vnua.edu.vn",
        )
        add_execution_trace(state, "input_guardrail", "failed", latency, {"reason": "empty_payload"})
        return state

    if len(normalized) > 4000:
        latency = int((time.perf_counter() - t0) * 1000)
        state["is_blocked"] = True
        state["block_reason"] = "Câu hỏi vượt quá giới hạn 4000 ký tự"
        state["block_category"] = "payload_too_large"
        state["status"] = RouteStatus.BLOCKED
        state["fallback"] = FallbackInfo(
            reason="payload_too_large",
            original_route="input_guardrail",
            fallback_strategy="safe_template",
            contact_channel="Ban Quản lý Đào tạo VNUA: phongdaotao@vnua.edu.vn",
        )
        add_execution_trace(state, "input_guardrail", "failed", latency, {"reason": "payload_too_large"})
        return state

    # 3. Check registered input guardrail component if available
    ext_guardrail = get_component("input_guardrail")
    if ext_guardrail is not None and hasattr(ext_guardrail, "validate"):
        try:
            result = ext_guardrail.validate(normalized)
            state["message"] = getattr(result, "sanitized_text", normalized)
            if not getattr(result, "is_safe", True):
                latency = int((time.perf_counter() - t0) * 1000)
                state["is_blocked"] = True
                violations = getattr(result, "violations", [])
                state["block_reason"] = (
                    violations[0] if violations else "Yêu cầu bị chặn bởi chính sách an toàn"
                )
                state["block_category"] = "guardrail_violation"
                state["status"] = RouteStatus.BLOCKED
                state["fallback"] = FallbackInfo(
                    reason="guardrail_blocked",
                    original_route="input_guardrail",
                    fallback_strategy="safe_template",
                    contact_channel="Ban Quản lý Đào tạo VNUA: phongdaotao@vnua.edu.vn",
                )
                add_execution_trace(state, "input_guardrail", "failed", latency, {"reason": state["block_reason"]})
                return state
        except Exception:
            pass  # Fall back to internal heuristics

    # 4. Prompt injection detection
    for pattern in INJECTION_PATTERNS:
        if pattern.search(normalized):
            latency = int((time.perf_counter() - t0) * 1000)
            state["is_blocked"] = True
            state["block_reason"] = "Phát hiện chỉ thị không an toàn hoặc yêu cầu vượt quyền (Prompt Injection)"
            state["block_category"] = "prompt_injection"
            state["status"] = RouteStatus.BLOCKED
            state["fallback"] = FallbackInfo(
                reason="prompt_injection_detected",
                original_route="input_guardrail",
                fallback_strategy="safe_template",
                contact_channel="Ban Quản lý Đào tạo VNUA: phongdaotao@vnua.edu.vn",
            )
            record_fallback("output_guardrail_blocked", "safe_template")
            add_execution_trace(state, "input_guardrail", "failed", latency, {"reason": "prompt_injection"})
            return state

    # 5. Raw PII check
    for pii_pat in PII_PATTERNS:
        if pii_pat.search(normalized):
            latency = int((time.perf_counter() - t0) * 1000)
            state["is_blocked"] = True
            state["block_reason"] = "Câu hỏi chứa thông tin cá nhân nhạy cảm (số thẻ/CCCD/mật khẩu)"
            state["block_category"] = "pii_violation"
            state["status"] = RouteStatus.BLOCKED
            state["fallback"] = FallbackInfo(
                reason="pii_detected",
                original_route="input_guardrail",
                fallback_strategy="safe_template",
                contact_channel="Ban Quản lý Đào tạo VNUA: phongdaotao@vnua.edu.vn",
            )
            add_execution_trace(state, "input_guardrail", "failed", latency, {"reason": "pii_detected"})
            return state

    # Input guardrail passed successfully
    latency = int((time.perf_counter() - t0) * 1000)
    state["is_blocked"] = False
    add_execution_trace(state, "input_guardrail", "passed", latency)
    return state


async def output_guardrail_node(state: GraphState) -> GraphState:
    """Performs 100% citation whitelist check, XSS sanitization, and PII masking."""
    t0 = time.perf_counter()
    state["current_stage"] = "output_guardrail"
    answer = state.get("answer", "")

    # 1. 100% Citation Whitelist Check
    # Collect all valid citation IDs from retrieved chunks and verified state citations
    valid_citation_ids: Set[str] = set()
    verified_citations: List[Citation] = []

    # Whitelist from state citations
    for cit in state.get("citations", []):
        if isinstance(cit, Citation):
            valid_citation_ids.add(cit.citation_id)
            verified_citations.append(cit)
        elif isinstance(cit, dict) and "citation_id" in cit:
            valid_citation_ids.add(cit["citation_id"])
            verified_citations.append(Citation(**cit))

    # Whitelist from cached citations
    for cit in state.get("cached_citations", []):
        if isinstance(cit, Citation):
            valid_citation_ids.add(cit.citation_id)
            if cit not in verified_citations:
                verified_citations.append(cit)
        elif isinstance(cit, dict) and "citation_id" in cit:
            valid_citation_ids.add(cit["citation_id"])
            verified_citations.append(Citation(**cit))

    # Whitelist from retrieved chunks
    for chunk in state.get("retrieved_chunks", []):
        c_id = chunk.get("citation_id")
        if c_id:
            valid_citation_ids.add(str(c_id))

    # Apply the full guardrail implementation for grounded answers. It checks
    # document/chunk membership, sanitizes HTML and masks PII.
    ext_guardrail = get_component("output_guardrail")
    if (
        state.get("status") == RouteStatus.ANSWERED
        and not state.get("cache_hit", False)
        and ext_guardrail is not None
        and hasattr(ext_guardrail, "validate")
    ):
        result = ext_guardrail.validate(
            answer=answer,
            citations=verified_citations,
            retrieved_chunks=state.get("retrieved_chunks", []),
            require_citations=True,
        )
        answer = result.sanitized_answer
        verified_citations = result.validated_citations
        valid_citation_ids = {citation.citation_id for citation in verified_citations}
        if not result.is_safe:
            state["status"] = RouteStatus.DEGRADED
            state["fallback"] = FallbackInfo(
                reason="output_guardrail_blocked",
                original_route="output_guardrail",
                fallback_strategy="safe_template",
                contact_channel="Ban Quản lý Đào tạo VNUA: phongdaotao@vnua.edu.vn",
            )
            verified_citations = []
            valid_citation_ids = set()

    # Verify inline citations in answer text (e.g., [src_1], [src_2])
    def replace_invalid_citation(match: re.Match[str]) -> str:
        tag = match.group(1)
        if tag in valid_citation_ids:
            return f"[{tag}]"
        # If hallucinated citation not in whitelist, strip tag
        return ""

    citation_pattern = re.compile(r"\[(src_\w+)\]")
    answer = citation_pattern.sub(replace_invalid_citation, answer)
    state["citations"] = verified_citations

    # 3. HTML and XSS Sanitization
    for pattern in XSS_PATTERNS:
        answer = pattern.sub("", answer)

    # 4. PII Masking on generated output
    for pii_pat in PII_PATTERNS:
        answer = pii_pat.sub("[THÔNG TIN ĐÃ ĐƯỢC ẨN]", answer)

    pii_filter = PIIFilter()
    verified_citations = [
        citation.model_copy(
            update={
                "title": pii_filter.mask_pii(citation.title),
                "snippet": pii_filter.mask_pii(citation.snippet),
            }
        )
        for citation in verified_citations
    ]
    state["citations"] = verified_citations

    state["answer"] = answer.strip()

    # Cache only grounded, fully guarded answers. Cache failures are degraded-safe.
    if (
        not state.get("cache_hit", False)
        and state.get("status") == RouteStatus.ANSWERED
        and state.get("answer")
        and verified_citations
        and not any(
            str(citation.document_id).startswith("mcp_") for citation in verified_citations
        )
    ):
        semantic_cache = get_component("semantic_cache")
        if semantic_cache is not None:
            try:
                await semantic_cache.set(
                    query=state.get("message", ""),
                    answer=state["answer"],
                    citations=verified_citations,
                    confidence=state.get("confidence", 0.0),
                    tenant_id=state.get("tenant_id", "vnua"),
                    locale=state.get("locale", "vi-VN"),
                    user_scope=str(state.get("user_id") or "anonymous"),
                )
            except Exception:
                pass

    if state.get("cache_lock_acquired"):
        semantic_cache = get_component("semantic_cache")
        if semantic_cache is not None:
            try:
                await semantic_cache.release_stampede_lock(
                    query=state.get("message", ""),
                    token=state.get("cache_lock_token") or "",
                    tenant_id=state.get("tenant_id", "vnua"),
                    locale=state.get("locale", "vi-VN"),
                    user_scope=str(state.get("user_id") or "anonymous"),
                )
            except Exception:
                pass
        state["cache_lock_acquired"] = False

    latency = int((time.perf_counter() - t0) * 1000)
    add_execution_trace(
        state,
        "output_guardrail",
        "passed",
        latency,
        {"citations_verified": len(verified_citations)},
    )
    return state
