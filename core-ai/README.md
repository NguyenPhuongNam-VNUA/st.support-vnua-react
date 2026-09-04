# ST-Care `core-ai` — Microservice Kiến trúc AI Trợ lý Sinh viên VNUA

> **Microservice Python độc lập** phụ trách toàn bộ pipeline RAG, LangGraph orchestration, LLM gateway đa provider, MCP tool gateway, semantic cache và ingestion tài liệu theo kiến trúc ST-Care VNUA.

---

## 1. Tổng quan Kiến trúc Hệ thống

`core-ai` hoạt động như một microservice AI độc lập, không phụ thuộc và không can thiệp trực tiếp vào mã nguồn Node.js BFF hay Frontend hiện tại. Mọi giao tiếp giữa Node.js backend và `core-ai` diễn ra qua giao thức HTTP/SSE nội bộ có xác thực bằng `INTERNAL_SERVICE_TOKEN`.

```mermaid
flowchart TD
    subgraph Client Layer
        UI["Next.js Frontend (Web / Mobile)"]
    end

    subgraph Application BFF
        NODE["Node.js Backend / BFF\n(Auth, RBAC, Sessions, APIs)"]
    end

    subgraph ST-Care core-ai Microservice
        API["FastAPI App (core-ai:5001)"]
        AUTH["Internal Auth Middleware\n(Bearer Token + Tenant Context)"]
        
        subgraph Guardrails & Processing
            IN_GUARD["Input Guardrail\n(Unicode NFC, Size, PII, Injection Detector)"]
            CACHE["Redis Semantic Cache\n(Degraded-Safe, Stampede Lock)"]
            RETRIEVAL["Parallel Hybrid Retrieval\n(BM25 Sparse + Gemini Embedding 2 Dense 1024d)"]
            RRF["RRF & Local Reranker\n(Evidence Score Assessment)"]
            LLM_GW["LLM Gateway (LLMPort)\n(Gemini / OpenAI / vLLM, Budget <= 2)"]
            MCP_GW["MCP Tool Gateway\n(Allowlist, Scopes, Circuit Breaker)"]
            OUT_GUARD["Output Guardrail\n(100% Citation Whitelist, XSS/PII Sanitizer)"]
        end

        SSE["SSE Event Streamer\n(RFC 8895: 5 Standard Events)"]
        OTEL["Observability\n(OpenTelemetry Tracing + Prometheus Metrics)"]
    end

    subgraph Infrastructure
        SUPAVISOR["Supavisor Transaction Pooler\n(PostgreSQL + pgvector, statement_cache=0)"]
        REDIS["Internal Redis 7.2.4\n(Internal Network, No Public Ports)"]
        LLM_PROVIDERS["AI Model Providers\n(Gemini 3.5 Flash / OpenAI / Local Ollama)"]
    end

    UI -->|"Public REST / WebSocket"| NODE
    NODE -->|"POST /v1/chat (SSE + Bearer token)"| API
    API --> AUTH --> IN_GUARD
    IN_GUARD --> CACHE
    CACHE -.->|"Cache Hit (0 AI Calls)"| OUT_GUARD
    CACHE -->|"Cache Miss"| RETRIEVAL
    RETRIEVAL --> SUPAVISOR
    RETRIEVAL --> RRF
    RRF --> LLM_GW
    RRF -.->|"Real-time Data Needed"| MCP_GW
    LLM_GW --> LLM_PROVIDERS
    LLM_GW --> OUT_GUARD
    OUT_GUARD --> SSE
    SSE -->|"text/event-stream"| NODE
    NODE -->|"Streamed Response"| UI
    CACHE --- REDIS
    API --- OTEL
```

---

## 2. Chi tiết các Thành phần Chính

### 2.1. API & Frozen Contracts (`src/core_ai/contracts/`)
Toàn bộ request/response schemas và typed events được đóng băng tại thư mục contracts:
- `contracts/chat.py`: `ChatRequest`, `ChatResponse`, `Citation`, `ExecutionTraceStep`, `FallbackInfo`, `RouteStatus`.
- `contracts/events.py`: 5 standard SSE event payloads theo chuẩn RFC 8895 (`request.accepted`, `pipeline.status`, `answer.delta`, `answer.completed`, `answer.error`).
- `contracts/llm.py`: `LLMPort` interface protocol, `GenerationRequest`, `GenerationResult`, `TokenUsage`.
- `contracts/mcp.py`: `MCPGateway` interface protocol, `ToolRequest`, `ToolResult`, `ToolScope`, `CircuitBreakerState`.
- `contracts/errors.py`: Hệ thống mã lỗi chuẩn hóa (`ErrorCode`) và exception hierarchy (`CoreAIError`).

### 2.2. LLM Gateway & Enforced Call Budget (`src/core_ai/llm/`)
- **Multi-Provider Abstraction**: Sử dụng LiteLLM adapter hỗ trợ chuyển đổi linh hoạt chỉ bằng cấu hình biến môi trường giữa:
  - Google Gemini (mặc định: `gemini-3.5-flash`).
  - OpenAI API (ví dụ: `gpt-4o`, `gpt-4o-mini`).
  - OpenAI-compatible endpoints (vLLM hoặc Ollama chạy Llama-3, Qwen local).
- **Enforced Call Budget**:
  - Trần tuyệt đối: **Tối đa 2 external AI calls** cho một request (kể cả retry và failover).
  - Normal path: Chỉ tiêu thụ đúng **1 external call** (Answer Generation).
  - Cache hit: Tiêu thụ đúng **0 external call**.
  - Không bao giờ gọi LLM lần thứ 3; nếu hết budget, chuyển sang verified fallback template hoặc HITL escalation.
- **Local Structured Output Repair**: Mọi output JSON sai cú pháp hoặc bị cắt ngắn đều được phân tích, sửa chữa cục bộ bằng regex/heuristic mà **không tốn thêm LLM call sửa JSON**.

### 2.3. MCP Tool Gateway (`src/core_ai/mcp/`)
- Tuân thủ official Python MCP SDK specification, hỗ trợ transport `streamable-http` và `stdio`.
- **Tool Allowlist & Scopes**:
  - `PUBLIC`: Mở cho toàn bộ người dùng (`search_knowledge`, `get_regulations`).
  - `AUTHENTICATED`: Bắt buộc có danh tính sinh viên `user_id` (`lookup_schedule`, `check_tuition`).
  - `ESCALATION`: Chỉ cho phép khi được chuyển cấp hỗ trợ cán bộ (`create_support_case`).
- **3-State Circuit Breaker**: Độc lập cho từng tool (`CLOSED` -> `OPEN` sau 3 lỗi liên tiếp -> `HALF_OPEN` sau 30s probe -> `CLOSED` sau 2 lần thành công).
- **Per-tool Timeout**: Giới hạn tối đa 3.0 giây cho mỗi lệnh gọi tool.

### 2.4. Data, Hybrid Retrieval & Semantic Cache (`src/core_ai/retrieval/`, `src/core_ai/data/`)
- **Supavisor Transaction Pooler**: `asyncpg` kết nối PostgreSQL với `statement_cache_size=0` bắt buộc; mọi query đều có điều kiện tenant isolation.
- **Hybrid Retrieval**: Chạy song song pgvector (Gemini Embedding 2, 1024 chiều, cosine similarity) và BM25 full-text search tiếng Việt.
- **RRF & Reranking**: Kết hợp qua thuật toán Reciprocal Rank Fusion (`k=60`) và local reranker đa tiêu chí để chọn lọc ra top 3-5 snippets có điểm bằng chứng cao nhất.
- **Semantic Cache trên Redis**: Key namespace `env:tenant:purpose:version:hash`.
- **Degraded-Safe Mode**: Nếu Redis dừng hoạt động hoặc timeout, hệ thống tự động đánh dấu `degraded`, bypass cache và tiếp tục pipeline retrieval an toàn mà không làm crash microservice.

### 2.5. Guardrails & An toàn Thông tin (`src/core_ai/guardrails/`)
- **Input Guardrail**: Chuẩn hóa Unicode NFC, loại bỏ ký tự vô hình/điều khiển, kiểm soát độ dài 1-4000 ký tự, chặn prompt injection/jailbreak song ngữ Anh - Việt, phát hiện và che giấu PII (CCCD 12 số, điện thoại, email, mật khẩu).
- **Output Guardrail**: Khử mã độc HTML/XSS, kiểm tra **100% Citation Whitelist** đối chiếu với các chunks được truy xuất từ retrieval; mọi citation ID không tồn tại hoặc bịa đặt đều bị chặn và loại bỏ khỏi nội dung phát cho sinh viên.
- **Zero Leakage**: Tuyệt đối không gửi raw system prompt, chain-of-thought, database credentials hay API keys trong SSE stream hay metadata.

### 2.6. Observability & Giám sát (`src/core_ai/observability/`, `monitoring/`)
- **OpenTelemetry Distributed Tracing**: Tạo trace spans an toàn (`trace_stage`), tự động lọc bỏ các thuộc tính chứa prompt hoặc PII (`FORBIDDEN_ATTRIBUTES`).
- **Prometheus Metrics Exporter**: Expose endpoint `/metrics` đo lường:
  - `core_ai_request_duration_seconds` (Histogram theo route, status, tenant).
  - `semantic_cache_hit_ratio` (Gauge tỉ lệ cache hit).
  - `core_ai_external_calls_total` (Counter cuộc gọi AI theo provider, model).
  - `core_ai_fallback_total` (Counter kích hoạt fallback theo lý do).
  - `core_ai_mcp_tool_duration_seconds` (Histogram thời gian chạy tool MCP).
  - `core_ai_redis_degraded_total` (Counter sự cố suy thoái Redis).

---

## 3. Bảng Cấu hình Biến Môi trường (`.env`)

| Biến môi trường | Kiểu dữ liệu | Giá trị mặc định | Mô tả |
|---|---|---|---|
| `APP_ENV` | string | `development` | Môi trường triển khai: `development`, `staging`, `production`, `testing` |
| `CORE_AI_HOST` | string | `0.0.0.0` | Địa chỉ IP lắng nghe của FastAPI server |
| `CORE_AI_PORT` | integer | `5001` | Cổng HTTP của microservice |
| `INTERNAL_SERVICE_TOKEN` | string | `""` | Bearer token bí mật dùng để xác thực các request nội bộ từ Node.js BFF |
| `DEFAULT_TENANT` | string | `vnua` | Tenant mặc định của hệ thống |
| `ALLOWED_TENANTS` | string / list | `vnua` | Danh sách tenant được cấp quyền (ngăn chặn cross-tenant access) |
| `LLM_PROVIDER` | string | `gemini` | Nhà cung cấp model: `gemini`, `openai`, `openai_compatible` |
| `LLM_MODEL` | string | `gemini-3.5-flash` | Định danh model LLM chính |
| `LLM_API_KEY` | string | `""` | API Key cho LLM provider (inject qua secret manager) |
| `LLM_BASE_URL` | string | `None` | Endpoint tương thích OpenAI (dành cho vLLM, Ollama) |
| `LLM_TIMEOUT_SECONDS` | float | `20.0` | Thời gian chờ tối đa cho mỗi lượt gọi model |
| `LLM_MAX_EXTERNAL_CALLS`| integer | `2` | Trần số lượt gọi AI bên ngoài cho một request |
| `LLM_FALLBACK_PROVIDER` | string | `None` | Provider dự phòng khi provider chính gặp sự cố |
| `LLM_FALLBACK_MODEL` | string | `None` | Model dự phòng |
| `EMBEDDING_PROVIDER` | string | `gemini` | Nhà cung cấp vector nhúng qua Gemini API |
| `EMBEDDING_MODEL` | string | `gemini-embedding-2` | Model Gemini Embedding 2 ổn định |
| `EMBEDDING_DIMENSION` | integer | `1024` | Kích thước vector tương thích schema pgvector hiện tại |
| `EMBEDDING_API_KEY` | string | `""` | API key; cũng chấp nhận `GEMINI_API_KEY` hoặc `GOOGLE_API_KEY` |
| `EMBEDDING_BASE_URL` | string | Gemini API v1beta | Base URL của Gemini Developer API |
| `EMBEDDING_TIMEOUT_SECONDS` | number | `20` | Timeout mỗi request embedding |
| `EMBEDDING_MAX_CONCURRENCY` | integer | `5` | Số request embedding chạy đồng thời tối đa |
| `DATABASE_URL` | string | `postgresql://...` | DSN kết nối PostgreSQL Supabase qua Supavisor pooler |
| `DB_STATEMENT_CACHE_SIZE`| integer | `0` | Bắt buộc phải là `0` để tương thích Supavisor transaction mode |
| `DB_POOL_MIN_SIZE` | integer | `2` | Kích thước pool kết nối tối thiểu |
| `DB_POOL_MAX_SIZE` | integer | `10` | Kích thước pool kết nối tối đa |
| `REDIS_URL` | string | `redis://localhost:6379/0` | URL kết nối Redis nội bộ |
| `REDIS_MAX_CONNECTIONS` | integer | `30` | Giới hạn connection pool của Redis |
| `MCP_TRANSPORT` | string | `streamable-http` | Giao thức MCP: `streamable-http` hoặc `stdio` |
| `MCP_TOOL_TIMEOUT_SECONDS`| float | `3.0` | Timeout tối đa cho từng công cụ MCP |
| `MCP_ALLOWED_TOOLS` | string | `search_knowledge,...`| Danh sách tool được phép kích hoạt |
| `OTEL_SERVICE_NAME` | string | `st-care-core-ai` | Tên service đăng ký trong OpenTelemetry collector |
| `OTEL_EXPORTER_OTLP_ENDPOINT`| string | `None` | URL gửi telemetry gRPC/HTTP OTLP |
| `LOG_RAW_PROMPTS` | boolean | `false` | Bật/tắt ghi log prompt thô (mặc định tắt vì an toàn PII) |

---

## 4. Hướng dẫn Triển khai bằng Docker & Compose

### 4.1. Cấu trúc Triển khai
Hệ thống bao gồm file `Dockerfile` tối ưu hóa nhiều tầng (multi-stage build) và `compose.yaml` tích hợp sẵn Redis nội bộ chạy trong network độc lập:
- Redis image được pin version: `redis:7.2.4-alpine`.
- Không map cổng Redis ra ngoài máy chủ host ở production (`expose: 6379`).
- Có cấu hình kiểm tra sức khỏe `healthcheck` tự động cho cả Redis và `core-ai`.

### 4.2. Khởi chạy Dịch vụ

```bash
# 1. Di chuyển vào thư mục service
cd core-ai

# 2. Tạo file cấu hình môi trường từ mẫu
cp .env.example .env
# Chỉnh sửa INTERNAL_SERVICE_TOKEN và các thông tin cấu hình cần thiết trong .env

# 3. Khởi chạy core-ai và Redis nội bộ
docker compose up -d --build

# 4. Kiểm tra trạng thái containers và healthcheck
docker compose ps
```

### 4.3. Khởi chạy Kèm Giám sát Prometheus (Tùy chọn)

```bash
# Khởi chạy kèm profile monitoring
docker compose --profile monitoring up -d

# Truy cập dashboard Prometheus: http://localhost:9090
```

### 4.4. Kiểm tra Endpoint Healthcheck

```bash
# Liveness probe (kiểm tra tiến trình sống)
curl -i http://localhost:5001/health/live

# Readiness probe (kiểm tra kết nối DB và Redis)
curl -i http://localhost:5001/health/ready
```

---

## 5. Hướng dẫn Kiểm thử Toàn diện (Manual Testing Guide)

Toàn bộ test suite được thiết kế **độc lập 100% với các dịch vụ bên ngoài** (sử dụng in-memory mocks cho Redis, asyncpg, LiteLLM, và MCP). Người dùng có thể chủ động chạy toàn bộ hoặc từng nhóm test độc lập bằng `pytest`.

### 5.1. Cài đặt Môi trường Test Cục bộ

```bash
cd core-ai

# Khuyến nghị dùng môi trường ảo Python 3.11+
python -m venv .venv
# Trên Linux/macOS:
source .venv/bin/activate
# Trên Windows PowerShell:
.venv\Scripts\Activate.ps1

# Cài đặt dependencies bao gồm nhóm dev
pip install -e ".[dev]"
```

### 5.2. Các Lệnh Chạy Test theo Nhóm

```bash
# 1. Chạy toàn bộ 8 nhóm kiểm thử
pytest tests/ -v

# 2. Chạy nhóm Unit Tests (RRF, Reranker, Cache Key, Parser, Guardrails)
pytest tests/unit/ -v

# 3. Chạy nhóm Contract Tests (Pydantic models, SSE events, Error codes)
pytest tests/contract/ -v

# 4. Chạy nhóm Retrieval Tests (Hybrid search merge, Tenant isolation)
pytest tests/retrieval/ -v

# 5. Chạy nhóm LLM Tests (Provider abstraction, 2-call budget enforcement)
pytest tests/llm/ -v

# 6. Chạy nhóm MCP Tests (Tool registry, Allowlist, 3-state Circuit Breaker)
pytest tests/mcp/ -v

# 7. Chạy nhóm Resilience Tests (Redis outage degraded mode, LLM failover)
pytest tests/resilience/ -v

# 8. Chạy nhóm Security Tests (Prompt injection, Citation spoof, PII sanitization)
pytest tests/security/ -v

# 9. Chạy nhóm E2E Flow Tests (SSE chat streaming flow, Cache hit zero-call flow)
pytest tests/e2e/ -v

# 10. Chạy kiểm tra độ bao phủ mã nguồn (Code Coverage)
pytest tests/ --cov=src/core_ai --cov-report=term-missing
```

---

## 6. Tài liệu Đặc tả API (API Reference)

### 6.1. Endpoint Streaming Trò chuyện (`POST /v1/chat`)

- **URL**: `POST /v1/chat`
- **Headers**:
  - `Content-Type: application/json`
  - `Authorization: Bearer <INTERNAL_SERVICE_TOKEN>`
- **Request Body**:

```json
{
  "request_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "tenant_id": "vnua",
  "user_id": "sv_651234",
  "conversation_id": "c73bcdcc-1234-4567-89ab-cdef01234567",
  "message": "Sinh viên đại học chính quy được đăng ký tối đa bao nhiêu tín chỉ một học kỳ?",
  "locale": "vi-VN",
  "channel": "web"
}
```

- **Response Type**: `text/event-stream`
- **Trình tự các sự kiện SSE phát ra**:

```text
event: request.accepted
data: {"request_id":"9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d","conversation_id":"c73bcdcc-1234-4567-89ab-cdef01234567","timestamp":"2026-09-04T14:30:00.100Z","status":"accepted"}

event: pipeline.status
data: {"request_id":"9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d","stage":"retrieval","status":"in_progress","message":"Đang tìm kiếm tài liệu","message_vi":"Đang tìm kiếm tài liệu","progress_percent":50}

event: answer.delta
data: {"request_id":"9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d","delta":"Theo Quy chế đào tạo ","index":0}

event: answer.delta
data: {"request_id":"9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d","delta":"đại học của VNUA [src_1], ","index":1}

event: answer.completed
data: {
  "request_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "conversation_id": "c73bcdcc-1234-4567-89ab-cdef01234567",
  "status": "answered",
  "answer": "Theo Quy chế đào tạo đại học của VNUA [src_1], trong mỗi học kỳ chính, sinh viên được đăng ký tối đa 24 tín chỉ và tối thiểu 14 tín chỉ (trừ học kỳ cuối khóa).",
  "confidence": 0.94,
  "citations": [
    {
      "citation_id": "src_1",
      "document_id": 101,
      "title": "Quy chế đào tạo đại học chính quy VNUA",
      "page": 14,
      "snippet": "Sinh viên được phép đăng ký tối đa 24 tín chỉ trong một học kỳ chính.",
      "relevance_score": 0.92
    }
  ],
  "execution_trace": [
    {"step": "input_guardrail", "status": "passed", "latency_ms": 12},
    {"step": "semantic_cache", "status": "completed", "latency_ms": 18},
    {"step": "retrieval", "status": "completed", "latency_ms": 85},
    {"step": "generation", "status": "completed", "latency_ms": 620},
    {"step": "output_guardrail", "status": "passed", "latency_ms": 25}
  ],
  "fallback": null,
  "latency_ms": 780,
  "usage": {
    "prompt_tokens": 120,
    "completion_tokens": 45,
    "total_tokens": 165,
    "external_calls_count": 1
  }
}
```

### 6.2. Endpoint Tương thích Ngược Legacy (`POST /ask-ai`)

- **URL**: `POST /ask-ai`
- **Request Body**:
```json
{
  "question": "Học phí một tín chỉ là bao nhiêu?",
  "conversation_id": "legacy-conv-uuid",
  "tenant_id": "vnua"
}
```
- **Response**: Trả về JSON hoàn chỉnh `{"answer": "...", "status": "answered", "sources": [...]}` tương thích với frontend hiện hữu.

### 6.3. Endpoint Prometheus Metrics (`GET /metrics`)
- **URL**: `GET /metrics`
- **Output**: Định dạng chuẩn của Prometheus Text Exporter phục vụ thu thập dữ liệu bởi hệ thống giám sát.

---

## 7. Nguyên tắc An toàn & Cơ chế Phòng thủ

1. **Bảo vệ Thông tin Định danh (PII)**: Toàn bộ số CCCD, điện thoại, email cá nhân và mật khẩu đều được phát hiện và che giấu tự động tại Input Guardrail và Output Guardrail. Traces và logs tuyệt đối không ghi nhận dữ liệu nhạy cảm.
2. **Ngăn chặn Suy đoán (Hallucination)**: Mọi câu trả lời liên quan đến quy định, học phí, lịch học bắt buộc phải có trích dẫn nguồn (`citations`). Nếu điểm bằng chứng (`evidence_score`) thấp hơn `0.55`, hệ thống từ chối trả lời tự suy diễn và kích hoạt hỏi lại hoặc chuyển tiếp hỗ trợ cán bộ (HITL).
3. **Chống Chiếm quyền Điều khiển (Prompt Injection)**: Bộ nhận diện song ngữ quét và ngăn chặn ngay lập tức các câu lệnh yêu cầu tiết lộ system prompt, vượt qua bộ lọc hoặc đổi nhân vật.
4. **Phòng thủ Tắc nghẽn Hạ tầng**: Circuit Breaker tự động ngắt kết nối với các công cụ MCP bị lỗi hoặc timeout quá 3 giây. Redis degraded-safe đảm bảo nếu cache gặp sự cố thì hệ thống vẫn phục vụ bình thường từ cơ sở dữ liệu.
