# Project: ST-Care `core-ai` Microservice

## Architecture
`core-ai` is an independent Python microservice (FastAPI, Python 3.11+, uv/pyproject.toml) powering the RAG pipeline, LangGraph orchestration, multi-provider LLM gateway, MCP tool gateway, semantic cache, and background document ingestion for the ST-Care VNUA student assistant system.

```
Next.js BFF / Frontend
      │  HTTP/SSE + Bearer (INTERNAL_SERVICE_TOKEN)
      ▼
FastAPI App (src/core_ai/main.py, api/routes/chat.py, documents.py, health.py)
      │
      ├── Input Guardrail (Unicode norm, injection check, PII filter)
      │
      ├── LangGraph State Machine (src/core_ai/graph/)
      │     ├── Semantic Cache Lookup (Redis: env:tenant:purpose:version)
      │     │     ├─ [Hit] ──► Safe response with citations (0 external AI calls)
      │     │     └─ [Miss] ─► Parallel Hybrid Retrieval
      │     │
      │     ├── Parallel Hybrid Retrieval (src/core_ai/retrieval/)
      │     │     ├── pgvector (Gemini Embedding 2 1024d cosine distance <=> via Supavisor asyncpg)
      │     │     └── BM25 Full-Text Search
      │     │     └──► RRF (Reciprocal Rank Fusion) + Local Rerank (top 3-5)
      │     │
      │     ├── Evidence Evaluation
      │     │     ├─ [Sufficient] ──► LLM Generation (LLMPort -> Gemini-3.5-flash default)
      │     │     └─ [Weak/Uncertain] ─► MCP Tool Call or Clarify / HITL Fallback
      │     │
      │     └── Output Guardrail (100% citation whitelist check, PII mask, XSS sanitize)
      │
      └── SSE Response Stream (request.accepted -> pipeline.status -> answer.delta -> answer.completed)
```

---

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | FastAPI Lifespan & Service Config | App lifespan, Pydantic settings, dependency injection, middleware | M1 | R1, Plan §13 |
| 2 | Frozen Pydantic Contracts | Core schemas: `chat.py`, `events.py`, `llm.py`, `mcp.py`, `errors.py` | M1 | R1, C1, Plan §5-7 |
| 3 | SSE Streaming & Health Endpoints | `POST /v1/chat`, backward-compatible `/ask-ai`, `/documents/embed`, `/health/live`, `/health/ready` | M1 | R1, C2, Plan §5 |
| 4 | Internal Service Token Auth | Bearer auth verifying `INTERNAL_SERVICE_TOKEN` / `AI_AGENT_SERVICE_TOKEN`, tracking request context | M1 | R1, Plan §5 |
| 5 | LLMPort & Provider Abstraction | Decoupled protocol for model generation; switchable via env variables | M2 | R2, C3, Plan §6 |
| 6 | LiteLLM Adapter & Capability Mapping | Support Gemini (default `gemini-3.5-flash`), OpenAI, vLLM/Ollama (`openai_compatible`) | M2 | R2, C3, Plan §6 |
| 7 | Call Budget Enforcement | Maximum 2 external AI calls per request (0 on cache hit, 1 on normal generation) | M2 | R2, C3, Plan §6 |
| 8 | Local Structured Output & Repair | Pydantic validation + local regex/repair parser without secondary LLM call | M2 | R2, C3, Plan §6 |
| 9 | ST-Care System Prompts | Grounded Vietnamese persona: concise, factual, evidence-only citations, no speculation | M2 | R2, Plan §6 |
| 10 | Model-Independent MCP Gateway | Official Python MCP SDK, `streamable-http` & `stdio` transport, tool registry | M3 | R3, C4, Plan §7 |
| 11 | 5 Core MCP Tools & Circuit Breaker | `search_knowledge`, `lookup_schedule`, `check_tuition`, `get_regulations`, `create_support_case` + 3s timeout & circuit breaker | M3 | R3, C4, Plan §7 |
| 12 | Supavisor asyncpg Pool & Repos | asyncpg with `statement_cache_size=0`, single-tenant `"vnua"` isolation, non-blocking DB calls | M4 | R4, C5, Plan §8 |
| 13 | Gemini Embedding 2 (1024d) | Gemini API embedding generator producing vectors compatible with `document_chunks.embedding` | M4 | R4, Plan §6, DB.sql |
| 14 | Parallel BM25 & pgvector Search | Concurrent execution of dense cosine distance (`<=>`) and sparse BM25 | M4 | R4, C5, Plan §10 |
| 15 | RRF Fusion & Local Reranking | Reciprocal Rank Fusion of dense + sparse hits, local score ranking to select top 3-5 snippets | M4 | R4, C5, Plan §10 |
| 16 | Redis Semantic Cache & Primitives | Key namespace `env:tenant:purpose:version`, stampede distributed lock, degraded-safe bypass on failure | M4 | R4, C5, Plan §9 |
| 17 | LangGraph State Machine Flow | Deterministic graph routing: cache check -> retrieval -> evidence eval -> generation -> guardrails | M5 | R5, Plan §10 |
| 18 | Deadline, Budget & Trace Tracking | Enforce timeout deadline, trace latency per node, emit safe `execution_trace` (no CoT/PII) | M5 | R5, C2, Plan §5,10 |
| 19 | Fallback & HITL Orchestration | Degraded response, clarification questions, support case ticket creation upon weak evidence | M5 | R5, Plan §11 |
| 20 | Input Guardrails | Unicode normalization, payload size check (1-4000 chars), prompt injection regex, raw PII check | M6 | R6, C6, Plan §10 |
| 21 | Output Guardrails | 100% citation whitelist check against retrieved chunks, HTML/XSS sanitization, PII masking | M6 | R6, C6, Plan §10 |
| 22 | Document Ingestion Worker | Background task: download signed URL PDF, extract text, chunk with overlap, generate Gemini Embedding 2 vectors, update `document_chunks` & `documents` status | M6 | R6, C6, Plan §10, DB.sql |
| 23 | OpenTelemetry & Prometheus Metrics | Traces, Prometheus metrics exporter (`core_ai_request_duration_seconds`, `semantic_cache_hit_ratio`, etc.) | M7 | R7, Plan §12 |
| 24 | Dockerfile & Isolated Redis Compose | Multi-stage Dockerfile, `compose.yaml` with internal Redis (no public port), healthcheck | M7 | R7, C5, Plan §9 |
| 25 | 8-Category Comprehensive Mock Test Suite | Unit, Contract, Retrieval, LLM, MCP, Resilience, Security, E2E test suites with complete mocks | M7 | R7, C7, Plan §15 |
| 26 | Documentation & Configuration Template | Comprehensive `README.md`, `.env.example`, architecture and testing guide | M7 | R7, C7, Plan §16 |
| 27 | Static Verification & Forensic Audit | Verification across C1-C7, adversarial checks, forensic integrity audit (no dummy facades, no test execution) | M8 | C1-C7, DoD |

---

## Milestones
| # | Milestone Name | Scope (File Ownership) | Dependencies | Status |
|---|----------------|------------------------|-------------|--------|
| M1 | Foundation, Frozen Contracts & SSE Endpoint | Agent 1: `src/core_ai/main.py`, `config.py`, `dependencies.py`, `src/core_ai/api/**`, `src/core_ai/contracts/**`, `pyproject.toml`, `.env.example` | Survey | DONE |
| M2 | LLM Gateway & ST-Care Prompts | Agent 2: `src/core_ai/llm/**` | M1 | DONE |
| M3 | MCP Tool Gateway & Core Tools | Agent 3: `src/core_ai/mcp/**` | M1 | DONE |
| M4 | Supavisor PostgreSQL, Hybrid Retrieval & Redis Cache | Agent 4: `src/core_ai/data/**`, `src/core_ai/retrieval/**` | M1 | DONE |
| M5 | LangGraph Orchestration State Machine | Agent 5: `src/core_ai/graph/**` | M1, M2, M3, M4 | DONE |
| M6 | Guardrails & Offline Ingestion Worker | Agent 6: `src/core_ai/guardrails/**`, `src/core_ai/ingestion/**`, `scripts/**` | M1, M4 | DONE |
| M7 | Platform, Observability & Comprehensive Test Suites | Agent 7: `src/core_ai/observability/**`, `monitoring/**`, `tests/**`, `Dockerfile`, `compose.yaml`, `README.md` | M1-M6 | DONE |
| M8 | Integration Review, Adversarial Verification & Forensic Audit | Full verification across all criteria C1-C7, Challenger & Auditor review | M1-M7 | IN_PROGRESS |

---

## Interface Contracts

### 1. `src/core_ai/contracts/chat.py`
- `ChatRequest`: `request_id: str`, `tenant_id: str = "vnua"`, `user_id: Optional[str]`, `conversation_id: Optional[Union[int, str]]`, `message: str` (1-4000 chars, alias `question`), `locale: str = "vi-VN"`, `channel: str = "web"`.
- `RouteStatus`: Enum (`answered`, `clarified`, `redirected`, `blocked`, `degraded`, `escalated`).
- `Citation`: `citation_id: str`, `document_id: Union[int, str]`, `title: str`, `page: Optional[int]`, `chunk_index: Optional[int]`, `snippet: str`, `relevance_score: float`.
- `ExecutionTraceStep`: `step: str`, `status: str`, `latency_ms: int`, `details: Optional[Dict[str, Any]] = None` (No raw prompts, No CoT, No PII).
- `FallbackInfo`: `reason: str`, `original_route: Optional[str]`, `fallback_strategy: str`, `contact_channel: Optional[str]`, `ticket_id: Optional[str]`.
- `ChatResponse`: `request_id: str`, `conversation_id: Optional[Union[int, str]]`, `status: RouteStatus`, `answer: str`, `confidence: float`, `citations: List[Citation]` (alias `sources`), `execution_trace: List[ExecutionTraceStep]`, `fallback: Optional[FallbackInfo]`, `latency_ms: int`.
- `DocumentEmbedRequest`: `document_id: Union[int, str]`, `file_url: str`.
- `DocumentEmbedResponse`: `document_id: Union[int, str]`, `status: str`, `job_id: str`.

### 2. `src/core_ai/contracts/events.py`
- SSE Event types:
  * `request.accepted`: payload `{ request_id: str, conversation_id: Optional[Union[int, str]], status: "accepted", timestamp: str }`
  * `pipeline.status`: payload `{ step: str, message_vi: str, progress_percent: int }` (Strictly friendly Vietnamese labels: "Đang kiểm tra câu hỏi", "Đang tìm kiếm tài liệu", "Đang tổng hợp câu trả lời", "Đang xác minh nguồn trích dẫn")
  * `answer.delta`: payload `{ delta: str, index: int }` (Only emitted after output guardrail validation)
  * `answer.completed`: payload `{ response: ChatResponse }`
  * `answer.error`: payload `{ error_code: str, message: str, retryable: bool, fallback_channel: Optional[str] }`

### 3. `src/core_ai/contracts/llm.py`
- `LLMPort` Protocol:
  * `async def generate(self, request: GenerationRequest) -> GenerationResult`
- `GenerationRequest`: `prompt: str`, `system_prompt: Optional[str]`, `temperature: float = 0.2`, `max_tokens: int = 1024`, `json_schema: Optional[Dict[str, Any]]`, `external_calls_already_made: int = 0`.
- `GenerationResult`: `content: str`, `structured_output: Optional[Dict[str, Any]]`, `model_name: str`, `provider: str`, `tokens: TokenUsage`, `latency_ms: int`.
- `TokenUsage`: `prompt_tokens: int`, `completion_tokens: int`, `total_tokens: int`.
- `ProviderCapability`: `supports_json_schema: bool`, `supports_tool_calling: bool`, `max_context_tokens: int`.

### 4. `src/core_ai/contracts/mcp.py`
- `MCPGateway` Protocol:
  * `async def call_tool(self, request: ToolRequest) -> ToolResult`
  * `async def discover_tools(self) -> List[ToolDefinition]`
- `ToolRequest`: `tool_name: str`, `arguments: Dict[str, Any]`, `tenant_id: str`, `user_id: Optional[str]`, `timeout_seconds: float = 3.0`.
- `ToolResult`: `tool_name: str`, `success: bool`, `data: Optional[Dict[str, Any]]`, `error: Optional[str]`, `latency_ms: int`.
- `CircuitBreakerState`: Enum (`CLOSED`, `OPEN`, `HALF_OPEN`).

### 5. `src/core_ai/contracts/errors.py`
- Standardized stable error codes:
  * `AUTH_FAILED` (401)
  * `FORBIDDEN` (403)
  * `RATE_LIMITED` (429)
  * `BUDGET_EXCEEDED` (429)
  * `INVALID_PAYLOAD` (422)
  * `GUARDRAIL_BLOCKED` (400)
  * `RETRIEVAL_FAILED` (500)
  * `PROVIDER_TIMEOUT` (504)
  * `PROVIDER_UNAVAILABLE` (503)
  * `CIRCUIT_BREAKER_OPEN` (503)
  * `INTERNAL_ERROR` (500)
- `CoreAIError` base exception class with `error_code`, `status_code`, `message`, `retryable`.

---

## Code Layout
```
core-ai/
├── src/core_ai/
│   ├── main.py                     (Agent 1)
│   ├── config.py                   (Agent 1)
│   ├── dependencies.py             (Agent 1)
│   ├── api/                        (Agent 1)
│   │   ├── routes/chat.py
│   │   ├── routes/documents.py
│   │   ├── routes/health.py
│   │   ├── middleware/auth.py
│   │   ├── middleware/request_context.py
│   │   └── schemas/
│   ├── contracts/                  (Agent 1)
│   │   ├── chat.py
│   │   ├── events.py
│   │   ├── llm.py
│   │   ├── mcp.py
│   │   └── errors.py
│   ├── llm/                        (Agent 2)
│   │   ├── port.py
│   │   ├── gateway.py
│   │   ├── litellm_adapter.py
│   │   ├── structured_output.py
│   │   └── prompts/st_care.py
│   ├── mcp/                        (Agent 3)
│   │   ├── gateway.py
│   │   ├── client_manager.py
│   │   ├── registry.py
│   │   ├── circuit_breaker.py
│   │   └── tools/
│   ├── data/                       (Agent 4)
│   │   ├── postgres.py
│   │   ├── repositories/document_repo.py
│   │   └── redis.py
│   ├── retrieval/                  (Agent 4)
│   │   ├── embeddings.py
│   │   ├── bm25.py
│   │   ├── vector_search.py
│   │   ├── semantic_cache.py
│   │   ├── rrf.py
│   │   ├── reranker.py
│   │   └── context_builder.py
│   ├── graph/                      (Agent 5)
│   │   ├── state.py
│   │   ├── builder.py
│   │   ├── routing.py
│   │   └── nodes/
│   ├── guardrails/                 (Agent 6)
│   │   ├── input_guardrail.py
│   │   ├── output_guardrail.py
│   │   └── pii_filter.py
│   ├── ingestion/                  (Agent 6)
│   │   ├── worker.py
│   │   ├── pdf_parser.py
│   │   └── chunker.py
│   ├── scripts/                    (Agent 6)
│   └── observability/              (Agent 7)
│       ├── tracer.py
│       └── metrics.py
├── monitoring/                     (Agent 7)
│   └── prometheus.yml
├── tests/                          (Agent 7)
│   ├── unit/
│   ├── contract/
│   ├── retrieval/
│   ├── llm/
│   ├── mcp/
│   ├── resilience/
│   ├── security/
│   └── e2e/
├── compose.yaml                    (Agent 7)
├── Dockerfile                      (Agent 7)
├── pyproject.toml                  (Agent 1)
├── .env.example                    (Agent 1)
└── README.md                       (Agent 7)
```
