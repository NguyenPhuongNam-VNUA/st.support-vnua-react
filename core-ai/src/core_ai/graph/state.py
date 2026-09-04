"""LangGraph State Definition and execution trace helpers for ST-Care Core AI.

Defines the centralized GraphState schema passed across all graph nodes,
enforcing strict call budgets, execution trace safety (no raw prompts, CoT, or PII),
and evidence tracking.
"""

from __future__ import annotations

import time
from typing import Any, Dict, List, Literal, Optional, TypedDict, Union

from core_ai.contracts.chat import (
    Citation,
    ExecutionTraceStep,
    FallbackInfo,
    RouteStatus,
)


class GraphState(TypedDict, total=False):
    """Central state dictionary passed through LangGraph orchestration nodes."""

    # 1. Identity and Context
    request_id: str
    tenant_id: str
    user_id: Optional[Union[int, str]]
    conversation_id: Optional[Union[int, str]]
    message: str  # Original normalized student query
    locale: str
    channel: str

    # 2. Input Guardrail State
    is_blocked: bool
    block_reason: Optional[str]
    block_category: Optional[str]

    # 3. Semantic Cache State
    cache_hit: bool
    cached_answer: Optional[str]
    cached_citations: List[Citation]
    cached_confidence: Optional[float]

    # 4. Retrieval & Corrective Search
    query_variants: List[str]
    retrieval_attempts: int  # Initial retrieval = 1, corrective retry = 2 (max 1 retry)
    retrieved_chunks: List[Dict[str, Any]]
    citations: List[Citation]
    evidence_score: float
    evidence_threshold: float
    is_sufficient_evidence: bool

    # 5. MCP Tool Execution State
    tool_calls_made: int
    tool_results: List[Dict[str, Any]]
    tool_name_requested: Optional[str]
    tool_args_requested: Optional[Dict[str, Any]]

    # 6. Generation & Model Accounting
    external_calls_count: int  # Hard ceiling <= 2
    max_external_calls: int  # Default 2
    answer: str
    confidence: float
    model_used: Optional[str]
    provider_used: Optional[str]
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int

    # 7. Routing & Terminal Status
    status: RouteStatus
    current_stage: str
    fallback: Optional[FallbackInfo]
    error: Optional[str]
    error_code: Optional[str]

    # 8. Observability & Safe Tracing
    execution_trace: List[ExecutionTraceStep]
    start_time: float
    total_latency_ms: int


def create_initial_state(
    request_id: str,
    message: str,
    tenant_id: str = "vnua",
    user_id: Optional[Union[int, str]] = None,
    conversation_id: Optional[Union[int, str]] = None,
    locale: str = "vi-VN",
    channel: str = "web",
    evidence_threshold: float = 0.60,
    max_external_calls: int = 2,
) -> GraphState:
    """Instantiate a clean GraphState dictionary with secure defaults."""
    return {
        "request_id": request_id,
        "tenant_id": tenant_id or "vnua",
        "user_id": user_id,
        "conversation_id": conversation_id,
        "message": message.strip(),
        "locale": locale or "vi-VN",
        "channel": channel or "web",
        "is_blocked": False,
        "block_reason": None,
        "block_category": None,
        "cache_hit": False,
        "cached_answer": None,
        "cached_citations": [],
        "cached_confidence": None,
        "query_variants": [message.strip()],
        "retrieval_attempts": 0,
        "retrieved_chunks": [],
        "citations": [],
        "evidence_score": 0.0,
        "evidence_threshold": evidence_threshold,
        "is_sufficient_evidence": False,
        "tool_calls_made": 0,
        "tool_results": [],
        "tool_name_requested": None,
        "tool_args_requested": None,
        "external_calls_count": 0,
        "max_external_calls": max_external_calls,
        "answer": "",
        "confidence": 0.0,
        "model_used": None,
        "provider_used": None,
        "prompt_tokens": 0,
        "completion_tokens": 0,
        "total_tokens": 0,
        "status": RouteStatus.ANSWERED,
        "current_stage": "start",
        "fallback": None,
        "error": None,
        "error_code": None,
        "execution_trace": [],
        "start_time": time.perf_counter(),
        "total_latency_ms": 0,
    }


def add_execution_trace(
    state: GraphState,
    step: str,
    status: Literal["passed", "completed", "skipped", "failed", "degraded", "cached"],
    latency_ms: int,
    details: Optional[Dict[str, Any]] = None,
) -> None:
    """Appends a safe execution trace step.

    SECURITY MANDATE:
        Details MUST NEVER contain:
        - Raw prompt strings or system instructions
        - Chain-of-thought internal reasoning
        - Student Personally Identifiable Information (PII)
        - Raw database credentials, SQL statements, or API keys
    """
    safe_details: Optional[Dict[str, Any]] = None
    if details:
        # Sanitize details to ensure safety
        forbidden_keys = {
            "prompt",
            "raw_prompt",
            "system_prompt",
            "chain_of_thought",
            "cot",
            "reasoning",
            "password",
            "token",
            "api_key",
            "secret",
            "email",
            "phone",
            "cccd",
        }
        safe_details = {
            k: v for k, v in details.items() if k.lower() not in forbidden_keys
        }

    trace_step = ExecutionTraceStep(
        step=step,
        status=status,
        latency_ms=max(0, latency_ms),
        details=safe_details,
    )
    if "execution_trace" not in state or state["execution_trace"] is None:
        state["execution_trace"] = []
    state["execution_trace"].append(trace_step)
