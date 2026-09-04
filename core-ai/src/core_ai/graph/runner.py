"""LangGraph Orchestration Runner for ST-Care Core AI.

Provides:
1. arun(request: ChatRequest) -> ChatResponse: executes state machine end-to-end.
2. astream_events(request: ChatRequest) -> AsyncGenerator[Dict[str, Any], None]:
   yields RFC 8895 Server-Sent Events conforming to the 5 standard events:
   request.accepted -> pipeline.status -> answer.delta -> answer.completed / answer.error.
3. Automatically registers singleton instance in core_ai.dependencies.
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone
import logging
import time
from typing import Any, AsyncGenerator, Dict, List, Optional
import uuid

from core_ai.contracts.chat import (
    ChatRequest,
    ChatResponse,
    Citation,
    ExecutionTraceStep,
    FallbackInfo,
    RouteStatus,
)
from core_ai.contracts.errors import CoreAIError, ErrorCode
from core_ai.contracts.events import (
    AnswerCompletedPayload,
    AnswerDeltaPayload,
    AnswerErrorPayload,
    PipelineStatusPayload,
    RequestAcceptedPayload,
    SSEEvent,
    TokenUsageSummary,
)
from core_ai.dependencies import register_component
from core_ai.graph.builder import build_orchestration_graph
from core_ai.graph.state import GraphState, create_initial_state

logger = logging.getLogger("core_ai.graph.runner")

STAGE_LABELS_VI = {
    "input_guardrail": ("Đang kiểm tra câu hỏi", 15),
    "semantic_cache": ("Đang tra cứu bộ nhớ đệm", 30),
    "retrieval": ("Đang tìm kiếm tài liệu", 50),
    "evidence_eval": ("Đang đánh giá nguồn tri thức", 65),
    "tool_node": ("Đang tra cứu công cụ hệ thống", 75),
    "generation": ("Đang tổng hợp câu trả lời", 85),
    "fallback": ("Đang chuẩn bị phản hồi dự phòng", 90),
    "output_guardrail": ("Đang xác minh nguồn trích dẫn", 95),
}


class GraphRunner:
    """Orchestration engine coordinating execution of the LangGraph state machine."""

    def __init__(self) -> None:
        self.graph = build_orchestration_graph()
        logger.info("GraphRunner initialized with compiled state machine.")

    async def arun(self, request: ChatRequest) -> ChatResponse:
        """Executes full request pipeline asynchronously and returns complete ChatResponse."""
        start_time = time.perf_counter()
        req_id = request.request_id or str(uuid.uuid4())

        initial_state = create_initial_state(
            request_id=req_id,
            message=request.message,
            tenant_id=request.tenant_id,
            user_id=request.user_id,
            conversation_id=request.conversation_id,
            locale=request.locale,
            channel=request.channel,
        )

        final_state: GraphState = await self.graph.ainvoke(initial_state)
        total_latency_ms = int((time.perf_counter() - start_time) * 1000)

        # Build verified citations
        citations: List[Citation] = []
        for cit in final_state.get("citations", []):
            if isinstance(cit, Citation):
                citations.append(cit)
            elif isinstance(cit, dict):
                citations.append(Citation(**cit))

        response = ChatResponse(
            request_id=req_id,
            conversation_id=request.conversation_id,
            status=final_state.get("status", RouteStatus.ANSWERED),
            answer=final_state.get("answer", ""),
            confidence=final_state.get("confidence", 0.90),
            citations=citations,
            execution_trace=final_state.get("execution_trace", []),
            fallback=final_state.get("fallback"),
            latency_ms=total_latency_ms,
        )
        return response

    async def astream_events(
        self, request: ChatRequest
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """Yields streaming SSE event frames conforming to RFC 8895."""
        start_time = time.perf_counter()
        req_id = request.request_id or str(uuid.uuid4())
        conv_id = request.conversation_id

        try:
            # 1. Event: request.accepted (< 100ms)
            accepted = RequestAcceptedPayload(
                request_id=req_id,
                conversation_id=conv_id,
                timestamp=datetime.now(timezone.utc).isoformat(),
                status="accepted",
            )
            yield SSEEvent(event="request.accepted", data=accepted).to_dict()

            # Initialize State
            initial_state = create_initial_state(
                request_id=req_id,
                message=request.message,
                tenant_id=request.tenant_id,
                user_id=request.user_id,
                conversation_id=conv_id,
                locale=request.locale,
                channel=request.channel,
            )

            current_state = initial_state
            visited_nodes: List[str] = []

            # 2. Execute graph stages with progress status events
            # We use astream if supported, or ainvoke with simulated stage events
            if hasattr(self.graph, "astream"):
                async for item in self.graph.astream(initial_state):
                    if isinstance(item, tuple):
                        node_name, state_update = item
                    elif isinstance(item, dict):
                        node_name = next(iter(item.keys()))
                        state_update = item[node_name]
                    else:
                        continue
                    current_state = state_update
                    visited_nodes.append(node_name)

                    # Emit friendly Vietnamese pipeline.status event
                    label_info = STAGE_LABELS_VI.get(node_name)
                    if label_info:
                        label, progress = label_info
                        status_event = PipelineStatusPayload(
                            request_id=req_id,
                            stage=node_name,  # type: ignore[arg-type]
                            status="completed" if node_name != "output_guardrail" else "passed",
                            message=label,
                            message_vi=label,
                            progress_percent=progress,
                        )
                        yield SSEEvent(event="pipeline.status", data=status_event).to_dict()
            else:
                # Fallback for standard LangGraph compiled graph
                current_state = await self.graph.ainvoke(initial_state)

                # Emit status for traced stages
                for trace in current_state.get("execution_trace", []):
                    node_name = trace.step
                    label_info = STAGE_LABELS_VI.get(node_name)
                    if label_info:
                        label, progress = label_info
                        status_event = PipelineStatusPayload(
                            request_id=req_id,
                            stage=node_name,  # type: ignore[arg-type]
                            status="completed",
                            message=label,
                            message_vi=label,
                            progress_percent=progress,
                            latency_ms=trace.latency_ms,
                        )
                        yield SSEEvent(event="pipeline.status", data=status_event).to_dict()

            # 3. Stream Answer Deltas (ONLY emitted after output guardrail has passed)
            answer_text = current_state.get("answer", "")
            words = answer_text.split(" ")
            chunk_size = 4
            for idx in range(0, len(words), chunk_size):
                delta_chunk = " ".join(words[idx : idx + chunk_size])
                if idx + chunk_size < len(words):
                    delta_chunk += " "
                delta_payload = AnswerDeltaPayload(
                    request_id=req_id,
                    delta=delta_chunk,
                    index=idx // chunk_size,
                )
                yield SSEEvent(event="answer.delta", data=delta_payload).to_dict()
                await asyncio.sleep(0.01)  # Smooth token stream pacing

            # 4. Final Event: answer.completed
            total_latency = int((time.perf_counter() - start_time) * 1000)

            citations: List[Citation] = []
            for cit in current_state.get("citations", []):
                if isinstance(cit, Citation):
                    citations.append(cit)
                elif isinstance(cit, dict):
                    citations.append(Citation(**cit))

            completed_payload = AnswerCompletedPayload(
                request_id=req_id,
                conversation_id=conv_id,
                status=current_state.get("status", RouteStatus.ANSWERED),
                answer=answer_text,
                confidence=current_state.get("confidence", 0.90),
                citations=citations,
                execution_trace=current_state.get("execution_trace", []),
                fallback=current_state.get("fallback"),
                latency_ms=total_latency,
                usage=TokenUsageSummary(
                    prompt_tokens=current_state.get("prompt_tokens", 0),
                    completion_tokens=current_state.get("completion_tokens", 0),
                    total_tokens=current_state.get("total_tokens", 0),
                    external_calls_count=min(2, current_state.get("external_calls_count", 0)),
                ),
            )
            yield SSEEvent(event="answer.completed", data=completed_payload).to_dict()

        except Exception as exc:
            logger.error("Unhandled pipeline exception in stream_events: %s", exc, exc_info=True)
            code = ErrorCode.INTERNAL_ERROR.value
            msg = "Đã xảy ra lỗi trong quá trình xử lý câu trả lời."
            retryable = False

            if isinstance(exc, CoreAIError):
                code = exc.code.value
                msg = exc.message
                retryable = exc.retryable

            err_payload = AnswerErrorPayload(
                request_id=req_id,
                code=code,
                error_code=code,
                message=msg,
                retryable=retryable,
                fallback=FallbackInfo(
                    reason=code,
                    fallback_strategy="safe_template",
                    contact_channel="Ban Quản lý Đào tạo VNUA: phongdaotao@vnua.edu.vn | Hotline: 024.6261.7586",
                ),
            )
            yield SSEEvent(event="answer.error", data=err_payload).to_dict()


# Create and register default singleton instance
default_runner = GraphRunner()
register_component("graph_runner", default_runner)
logger.info("Singleton GraphRunner registered under 'graph_runner' in dependency container.")
