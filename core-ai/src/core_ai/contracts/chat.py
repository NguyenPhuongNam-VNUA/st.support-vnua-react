"""Chat and document ingestion request/response contracts.

Exchanged between the Next.js BFF / frontend and the core-ai microservice.
Supports both modern typed streaming payloads and legacy backwards compatibility.
"""

from enum import Enum
from typing import Any, Dict, List, Literal, Optional, Union
import unicodedata
import uuid

from pydantic import BaseModel, Field, model_validator


class RouteStatus(str, Enum):
    """Pipeline termination route status."""
    ANSWERED = "answered"      # Answer generated with verified evidence
    CLARIFIED = "clarified"    # Clarification requested due to ambiguous query
    REDIRECTED = "redirected"  # Query redirected to specific department/portal
    BLOCKED = "blocked"        # Blocked by input/output guardrail (injection, PII)
    DEGRADED = "degraded"      # Delivered under degraded mode (fallback template/cache)
    ESCALATED = "escalated"    # Case escalated to human staff (ticket created)


class Citation(BaseModel):
    """Verified source attribution linking answer claims to document chunks."""
    citation_id: str = Field(
        ...,
        description="Unique reference identifier matching inline citation tag (e.g. 'src_1')",
        examples=["src_1"],
    )
    document_id: int = Field(
        ...,
        gt=0,
        description="ID of the source document in PostgreSQL documents table",
        examples=[42, "doc_42"],
    )
    title: str = Field(
        ...,
        description="Official title or filename of the reference document",
        examples=["Quy chế đào tạo đại học năm 2024"],
    )
    page: Optional[int] = Field(
        default=None,
        ge=1,
        description="1-based page number where snippet appears (if applicable)",
        examples=[14],
    )
    chunk_index: Optional[int] = Field(
        default=None,
        ge=0,
        description="Index of the chunk in document_chunks table",
        examples=[3],
    )
    snippet: str = Field(
        ...,
        max_length=2000,
        description="Exact excerpt from document supporting the generated claim",
        examples=["Sinh viên được phép đăng ký tối đa 24 tín chỉ trong một học kỳ chính."],
    )
    relevance_score: Optional[float] = Field(
        default=None,
        ge=0.0,
        le=1.0,
        description="Consolidated RRF or reranker similarity score",
        examples=[0.892],
    )


class ExecutionTraceStep(BaseModel):
    """Safe execution metadata step logging pipeline progress without leaking chain-of-thought."""
    step: str = Field(
        ...,
        description="Pipeline step identifier (e.g. 'guardrail', 'retrieval', 'generation')",
        examples=["input_guardrail", "retrieval", "generation", "output_guardrail"],
    )
    status: Literal["passed", "completed", "skipped", "failed", "degraded", "cached"] = Field(
        ...,
        description="Execution status of this step",
    )
    latency_ms: int = Field(
        default=0,
        ge=0,
        description="Execution duration for this step in milliseconds",
        examples=[45],
    )
    details: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Safe metadata (e.g. snippet count, cache hit). NEVER contains raw prompts or PII.",
    )


class FallbackInfo(BaseModel):
    """Encapsulates graceful fallback reasons, alternate strategies, and HITL support routing."""
    reason: str = Field(
        ...,
        description="Standardized reason code triggering fallback",
        examples=["low_evidence_confidence", "provider_timeout", "budget_exceeded", "guardrail_blocked"],
    )
    original_route: Optional[str] = Field(
        default=None,
        description="Route that was attempted before fallback",
        examples=["answer_generation", "mcp_tool_execution"],
    )
    fallback_strategy: str = Field(
        ...,
        description="Recovery strategy applied",
        examples=["verified_cache", "safe_template", "clarify_prompt", "escalate_hitl"],
    )
    contact_channel: Optional[str] = Field(
        default=None,
        description="Staff contact channel provided to student",
        examples=["Ban Quản lý đào tạo: phongdaotao@vnua.edu.vn", "Hotline: 024.6261.7586"],
    )
    ticket_id: Optional[str] = Field(
        default=None,
        description="Support ticket ID if an escalation case was generated",
        examples=["CASE-2026-0042"],
    )


class ChatRequest(BaseModel):
    """Unified chat request schema for POST /v1/chat."""
    request_id: Optional[str] = Field(
        default=None,
        max_length=64,
        description="Unique request tracing ID (UUIDv4). Auto-generated if omitted.",
        examples=["550e8400-e29b-41d4-a716-446655440000"],
    )
    tenant_id: str = Field(
        default="vnua",
        min_length=1,
        max_length=64,
        description="Mandatory tenant isolation identifier",
        examples=["vnua"],
    )
    user_id: Optional[Union[int, str]] = Field(
        default=None,
        description="Authenticated student/staff ID (null for anonymous/guest sessions)",
        examples=["14", "SV651234"],
    )
    conversation_id: Optional[Union[int, str]] = Field(
        default=None,
        description="Conversation session ID for multi-turn history tracking",
        examples=[123, "b2f15598-63a2-4a0b-967b-2321458df89b"],
    )
    message: str = Field(
        default="",
        description="Student query text (normalized Unicode NFC, 1-4000 chars)",
        examples=["Học phí tín chỉ ngành Công nghệ thông tin năm học 2025 là bao nhiêu?"],
    )
    locale: str = Field(
        default="vi-VN",
        max_length=10,
        description="Locale for response formatting and retrieval weighting",
        examples=["vi-VN"],
    )
    channel: str = Field(
        default="web",
        max_length=32,
        description="Client channel origin",
        examples=["web", "mobile", "zalo"],
    )
    question: Optional[str] = Field(
        default=None,
        description="Legacy field alias for message supported during migration",
    )
    requested_tool: Optional[Literal["create_support_case"]] = Field(
        default=None,
        description="Explicit side-effect tool requested by the trusted BFF flow",
    )
    tool_arguments: Dict[str, Any] = Field(
        default_factory=dict,
        description="Arguments for an explicitly approved tool; never inferred by the model",
    )
    tool_approved: bool = Field(
        default=False,
        description="True only after explicit user confirmation in the trusted BFF flow",
    )

    @model_validator(mode="before")
    @classmethod
    def pre_validate_and_normalize(cls, data: Any) -> Any:
        if isinstance(data, dict):
            # Resolve message from 'question' if message is empty
            msg = data.get("message") or data.get("question") or ""
            if isinstance(msg, str):
                msg = unicodedata.normalize("NFC", msg)
                for zw in ("\u200b", "\u200c", "\u200d", "\ufeff", "\u200B", "\u200C", "\u200D", "\uFEFF"):
                    msg = msg.replace(zw, "")
                msg = msg.strip()
            data["message"] = msg
            if not data.get("request_id"):
                data["request_id"] = str(uuid.uuid4())
        return data

    @model_validator(mode="after")
    def validate_message_bounds(self) -> "ChatRequest":
        if not self.message or len(self.message) == 0:
            raise ValueError("Câu hỏi không được để trống (message/question cannot be empty)")
        if len(self.message) > 4000:
            raise ValueError("Câu hỏi không được vượt quá 4000 ký tự")
        return self


class LegacyChatMessage(BaseModel):
    """Message item for legacy /ask-ai endpoint conversation history."""
    role: Literal["user", "assistant", "system"] = Field(..., description="Message author role")
    text: Optional[str] = Field(default=None, description="Message content in legacy format")
    content: Optional[str] = Field(default=None, description="Message content in standard format")

    @model_validator(mode="before")
    @classmethod
    def resolve_text_or_content(cls, data: Any) -> Any:
        if isinstance(data, dict):
            txt = data.get("text") or data.get("content") or ""
            data["text"] = txt
            data["content"] = txt
        return data


class LegacyAskAiRequest(BaseModel):
    """Backwards-compatible request payload for existing Next.js POST /ask-ai."""
    question: str = Field(
        ...,
        min_length=1,
        max_length=4000,
        description="User query string",
    )
    messages: Optional[List[LegacyChatMessage]] = Field(
        default_factory=list,
        description="Conversation turns for context",
    )
    conversation_id: Optional[Union[int, str]] = Field(
        default=None,
        description="Conversation session identifier",
    )
    tenant_id: str = Field(
        default="vnua",
        description="Tenant identifier, defaulting to vnua",
    )
    user_id: Optional[Union[int, str]] = Field(
        default=None,
        description="Optional student or user ID",
    )

    @model_validator(mode="before")
    @classmethod
    def normalize_question(cls, data: Any) -> Any:
        if isinstance(data, dict):
            q = data.get("question") or data.get("message") or ""
            if isinstance(q, str):
                data["question"] = unicodedata.normalize("NFC", q).strip()
        return data


class ChatResponse(BaseModel):
    """Complete final non-streaming response object."""
    request_id: str = Field(..., description="Correlated request UUID")
    conversation_id: Optional[Union[int, str]] = Field(
        default=None,
        description="Conversation session ID",
    )
    status: RouteStatus = Field(..., description="Final processing route status")
    answer: str = Field(..., description="Sanitized, verified answer text in Markdown")
    confidence: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Confidence score based on evidence grounding and model certainty",
        examples=[0.94],
    )
    citations: List[Citation] = Field(
        default_factory=list,
        description="Verified citation list backing the claims in the answer",
    )
    execution_trace: List[ExecutionTraceStep] = Field(
        default_factory=list,
        description="Execution trace for observability without leaking internal prompts",
    )
    fallback: Optional[FallbackInfo] = Field(
        default=None,
        description="Fallback descriptor if standard answer generation could not complete",
    )
    latency_ms: int = Field(
        ...,
        ge=0,
        description="Total end-to-end request duration in milliseconds",
        examples=[890],
    )
    sources: Optional[List[Dict[str, Any]]] = Field(
        default=None,
        description="Legacy alias for citations list populated automatically",
    )

    @model_validator(mode="after")
    def sync_sources_alias(self) -> "ChatResponse":
        if self.sources is None and self.citations:
            self.sources = [
                {
                    "document_id": c.document_id,
                    "title": c.title,
                    "page": c.page,
                    "snippet": c.snippet,
                }
                for c in self.citations
            ]
        return self


class DocumentEmbedRequest(BaseModel):
    """Document ingestion trigger for offline worker."""
    document_id: Union[int, str] = Field(
        ...,
        description="PostgreSQL document record ID",
        examples=[42],
    )
    file_url: str = Field(
        ...,
        min_length=10,
        max_length=4096,
        pattern=r"^https://",
        description="Short-lived signed URL (max 5 mins) to fetch PDF from Supabase Storage",
    )


class DocumentEmbedResponse(BaseModel):
    """Response returned upon successfully queueing document embedding job."""
    document_id: Union[int, str] = Field(..., description="Document ID processed")
    status: str = Field(
        default="processing",
        description="Status of ingestion task ('queued' | 'processing' | 'ready')",
    )
    job_id: str = Field(
        ...,
        description="Background job tracking UUID",
    )
    task_id: Optional[str] = Field(
        default=None,
        description="Alias for job_id matching legacy clients",
    )
    message: str = Field(
        default="Tiến trình embedding tài liệu đã được khởi chạy",
        description="Status message in Vietnamese",
    )

    @model_validator(mode="after")
    def sync_task_id(self) -> "DocumentEmbedResponse":
        if self.task_id is None:
            self.task_id = self.job_id
        return self
