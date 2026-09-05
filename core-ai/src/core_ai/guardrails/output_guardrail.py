"""Output Guardrail for ST-Care Core AI microservice.

Verifies generated answers before emission to students:
1. 100% Citation Whitelist Verification: Strictly checks that all inline citations and
   citation metadata match retrieved document chunks. Blocks/strips fabricated citations.
2. Hallucination Defense: Detects and rejects responses that cite non-existent evidence.
3. PII Masking: Masks generated or leaked citizen IDs, phone numbers, or credentials.
4. HTML/XSS Sanitization: Cleans raw HTML tags, event handlers, and malicious script injections.
"""

import logging
import re
import time
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Set

from core_ai.contracts.chat import Citation, ExecutionTraceStep
from core_ai.guardrails.pii_filter import PIIFilter

logger = logging.getLogger("core_ai.guardrails.output_guardrail")


@dataclass
class OutputGuardrailResult:
    """Outcome of output guardrail verification."""

    is_safe: bool
    sanitized_answer: str
    validated_citations: List[Citation] = field(default_factory=list)
    blocked_citations: List[Dict[str, Any]] = field(default_factory=list)
    has_hallucinations: bool = False
    violations: List[str] = field(default_factory=list)
    latency_ms: int = 0

    def to_execution_trace_step(self) -> ExecutionTraceStep:
        """Emits standard execution trace step for observability."""
        return ExecutionTraceStep(
            step="output_guardrail",
            status="passed" if self.is_safe else "degraded",
            latency_ms=self.latency_ms,
            details={
                "validated_citations_count": len(self.validated_citations),
                "blocked_citations_count": len(self.blocked_citations),
                "has_hallucinations": self.has_hallucinations,
                "violations_count": len(self.violations),
            },
        )


class OutputGuardrail:
    """Sanitizes generated answer text and validates citation grounding against evidence."""

    # Unsafe HTML tags to strip completely
    _UNSAFE_HTML_TAGS = re.compile(
        r"(?i)<\s*(?:script|iframe|object|embed|style|form|input|button|svg|link|meta)\b[^>]*>.*?</\s*(?:script|iframe|object|embed|style|form|input|button|svg|link|meta)\s*>",
        re.DOTALL,
    )
    # Self-closing or dangling dangerous tags
    _UNSAFE_SELF_CLOSING = re.compile(
        r"(?i)<\s*(?:script|iframe|object|embed|style|form|input|button|svg|link|meta|img)\b[^>]*>",
    )
    # Dangerous HTML attributes / event handlers (onerror, onload, onclick, javascript:)
    _DANGEROUS_ATTRS = re.compile(r"(?i)\b(?:on\w+|javascript:|data:\s*text/html)\s*=[^>\s]*")

    # Inline citation pattern e.g. [src_1], [src_2], [1], [2]
    _INLINE_CITATION_PATTERN = re.compile(r"\[(?:src_)?(\d+)\]")

    # Safe fallback response when response is completely ungrounded or blocked
    SAFE_UNGROUNDED_FALLBACK = (
        "Thông tin này hiện chưa có đủ tài liệu chính thức được xác minh trong cơ sở "
        "dữ liệu của Nhà trường. Để đảm bảo tính chính xác, sinh viên vui lòng liên hệ "
        "trực tiếp phòng ban chức năng hoặc ban tư vấn ST-Care để được hướng dẫn."
    )

    def __init__(
        self,
        strict_citations: bool = True,
        mask_pii_in_output: bool = True,
    ) -> None:
        self.strict_citations = strict_citations
        self.mask_pii_in_output = mask_pii_in_output
        self.pii_filter = PIIFilter()

    def sanitize_html(self, text: str) -> str:
        """Removes dangerous XSS tags and attributes while preserving clean Markdown."""
        if not text:
            return ""

        try:
            import nh3

            return nh3.clean(
                text,
                tags=set(),
                attributes={},
                strip_comments=True,
            )
        except ImportError:
            pass

        # Deterministic fallback when optional sanitizer is unavailable.
        cleaned = self._UNSAFE_HTML_TAGS.sub("", text)
        # 2. Strip single/self-closing unsafe tags
        cleaned = self._UNSAFE_SELF_CLOSING.sub("", cleaned)
        # 3. Strip dangerous inline event handlers
        cleaned = self._DANGEROUS_ATTRS.sub("", cleaned)

        return cleaned

    @staticmethod
    def unsupported_factual_claims(answer: str, citations: List[Citation]) -> List[str]:
        """Find numeric/date claims whose values do not occur in verified evidence."""
        evidence = " ".join(citation.snippet.lower() for citation in citations)
        unsupported: List[str] = []
        # Ignore Markdown list ordinals and isolated one-digit values. Ground
        # dates, percentages, money and multi-digit quantities that can change
        # the meaning of student guidance.
        claim_pattern = re.compile(
            r"(?<!\w)(?:\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?|"
            r"\d+(?:[.,]\d+)?\s*%|\d{2,}(?:[.,]\d+)*)(?!\w)"
        )
        for sentence in re.split(r"(?<=[.!?])\s+|\n+", answer):
            values = claim_pattern.findall(sentence)
            if values and any(value.lower() not in evidence for value in values):
                unsupported.append(sentence[:240])
        return unsupported

    def verify_and_filter_citations(
        self,
        citations: List[Citation],
        retrieved_chunks: List[Any],
    ) -> tuple[List[Citation], List[Dict[str, Any]], bool]:
        """Strictly validates citation list against retrieved chunk evidence.

        Returns:
            (validated_citations, blocked_citations, has_hallucinations)
        """
        if not citations:
            return [], [], False

        # Build whitelist of valid document IDs and chunk IDs from retrieved context
        valid_doc_ids: Set[str] = set()
        valid_chunk_keys: Set[str] = set()

        for chunk in retrieved_chunks:
            # Support ChunkRecord, dict, or object with document_id / chunk_index / id
            doc_id = None
            chunk_idx = None

            if isinstance(chunk, dict):
                doc_id = chunk.get("document_id")
                chunk_idx = chunk.get("chunk_index")
                if "id" in chunk:
                    valid_chunk_keys.add(str(chunk["id"]))
            else:
                doc_id = getattr(chunk, "document_id", None)
                chunk_idx = getattr(chunk, "chunk_index", None)
                if hasattr(chunk, "id"):
                    valid_chunk_keys.add(str(chunk.id))

            if doc_id is not None:
                valid_doc_ids.add(str(doc_id))
            if doc_id is not None and chunk_idx is not None:
                valid_chunk_keys.add(f"{doc_id}:{chunk_idx}")

        validated: List[Citation] = []
        blocked: List[Dict[str, Any]] = []
        has_hallucinations = False

        for cit in citations:
            doc_id_str = str(cit.document_id)
            chunk_key = f"{doc_id_str}:{cit.chunk_index}" if cit.chunk_index is not None else None

            # Verification rule: document_id must exist in retrieved chunks
            is_valid_doc = doc_id_str in valid_doc_ids
            is_valid_chunk = (chunk_key in valid_chunk_keys) if chunk_key else True

            if is_valid_doc and is_valid_chunk:
                validated.append(cit)
            else:
                has_hallucinations = True
                blocked.append(
                    {
                        "citation_id": cit.citation_id,
                        "document_id": cit.document_id,
                        "title": cit.title,
                        "reason": "Document ID or chunk not present in retrieved context",
                    }
                )
                logger.warning(
                    "Blocked hallucinated citation: id=%s, doc_id=%s, title=%s",
                    cit.citation_id,
                    cit.document_id,
                    cit.title,
                )

        return validated, blocked, has_hallucinations

    def clean_inline_citations(
        self,
        text: str,
        valid_indices: Set[int],
    ) -> str:
        """Removes or scrubs inline citation markers [src_X] that point to non-existent sources."""

        def replace_match(match: re.Match[str]) -> str:
            idx = int(match.group(1))
            if idx in valid_indices:
                return str(match.group(0))  # Keep valid reference
            # Remove hallucinated tag
            return ""

        cleaned = self._INLINE_CITATION_PATTERN.sub(replace_match, text)
        # Clean double spaces caused by removed tags
        cleaned = re.sub(r"\s{2,}", " ", cleaned)
        return cleaned

    def validate(
        self,
        answer: str,
        citations: Optional[List[Citation]] = None,
        retrieved_chunks: Optional[List[Any]] = None,
        require_citations: bool = False,
    ) -> OutputGuardrailResult:
        """Applies comprehensive output guardrail verification.

        Args:
            answer: Raw generated text from LLM.
            citations: List of Citation objects claimed by the model.
            retrieved_chunks: Ground truth retrieved context chunks.
            require_citations: If True and citations are empty or all hallucinated,
                               blocks and falls back to safe grounded response.

        Returns:
            OutputGuardrailResult with sanitized answer, verified citations, and flags.
        """
        t0 = time.perf_counter()
        violations: List[str] = []
        is_safe = True
        raw_citations = citations or []
        chunks = retrieved_chunks or []

        # 1. HTML / XSS Sanitization
        sanitized = self.sanitize_html(answer)

        # 2. PII Masking
        if self.mask_pii_in_output:
            sanitized = self.pii_filter.mask_pii(sanitized, full_redaction=False)

        # 3. 100% Citation Whitelist Verification
        validated_citations, blocked_citations, has_hallucinations = (
            self.verify_and_filter_citations(raw_citations, chunks)
        )

        if has_hallucinations:
            violations.append(
                f"Phát hiện {len(blocked_citations)} trích dẫn ảo "
                "(không có trong tài liệu đối chiếu)"
            )

        # 4. Clean Inline Citations in Text
        # Map 1-based sequential indices that are valid
        valid_indices: Set[int] = set()
        for i, c in enumerate(validated_citations, start=1):
            valid_indices.add(i)
            # Also support numerical suffix from citation_id (e.g. 'src_1' -> 1)
            num_match = re.search(r"\d+", c.citation_id)
            if num_match:
                valid_indices.add(int(num_match.group(0)))

        inline_matches = list(self._INLINE_CITATION_PATTERN.finditer(sanitized))
        invalid_inline = any(int(match.group(1)) not in valid_indices for match in inline_matches)
        sanitized = self.clean_inline_citations(sanitized, valid_indices)

        unsupported_claims = self.unsupported_factual_claims(sanitized, validated_citations)

        # 5. Hallucination Blocking Policy
        # If citations were strictly required (e.g. tuition, regulations) but none valid remain
        missing_required_inline = (
            require_citations and bool(validated_citations) and not inline_matches
        )
        if require_citations and (
            (raw_citations and not validated_citations)
            or invalid_inline
            or missing_required_inline
            or unsupported_claims
        ):
            logger.warning("Citation grounding failed; triggering safe ungrounded fallback.")
            sanitized = self.SAFE_UNGROUNDED_FALLBACK
            is_safe = False
            if invalid_inline:
                violations.append("Câu trả lời chứa thẻ trích dẫn không thuộc nguồn đã xác minh.")
                has_hallucinations = True
            elif missing_required_inline:
                violations.append("Câu trả lời thiếu thẻ trích dẫn bắt buộc.")
            elif unsupported_claims:
                violations.append(
                    f"Có {len(unsupported_claims)} phát biểu chứa số/ngày "
                    "không được nguồn xác nhận."
                )
            else:
                violations.append("Toàn bộ nguồn trích dẫn không hợp lệ.")
            violations.append("Đã áp dụng phản hồi an toàn.")

        latency_ms = int((time.perf_counter() - t0) * 1000)

        return OutputGuardrailResult(
            is_safe=is_safe,
            sanitized_answer=sanitized.strip(),
            validated_citations=validated_citations,
            blocked_citations=blocked_citations,
            has_hallucinations=has_hallucinations,
            violations=violations,
            latency_ms=latency_ms,
        )
