# Hợp đồng tích hợp Python AI Agent

Python là dịch vụ AI/RAG nội bộ. Xác thực người dùng và phân quyền admin vẫn do Next.js/Node.js chịu trách nhiệm.

## Luồng chat

```text
Browser -> POST /api/chat -> Next.js -> POST {PYTHON_AGENT_BASE_URL}/ask-ai
Python -> Supabase/pgvector -> LLM -> Python -> Next.js -> Browser
```

Next.js gửi:

```http
Authorization: Bearer <AI_AGENT_SERVICE_TOKEN>
Content-Type: application/json
```

Body tối thiểu:

```json
{
  "question": "Học phí ngành CNTT là bao nhiêu?",
  "messages": []
}
```

Response tương thích UI hiện tại:

```json
{
  "answer": "Nội dung trả lời",
  "status": "answered",
  "conversation_id": 123,
  "sources": []
}
```

## Luồng embedding tài liệu

Next.js gọi:

```http
POST {PYTHON_AGENT_BASE_URL}/documents/embed
Authorization: Bearer <AI_AGENT_SERVICE_TOKEN>
```

```json
{
  "document_id": 42,
  "file_url": "signed-url-5-minutes"
}
```

Python thực hiện:

1. Tải PDF từ signed URL.
2. Tách nội dung và tạo chunk.
3. Sinh embedding đúng 1024 chiều như schema hiện tại.
4. Ghi `document_chunks` với `document_id`, `chunk_index`, `page`, `tokens`, `content`, `embedding`.
5. Cập nhật `documents.pipeline_stage` và `progress`.

## Kết nối PostgreSQL

Khuyến nghị Python dùng `asyncpg` hoặc SQLAlchemy qua Supavisor pooler và một login role kế thừa đúng một trong hai group role:

- `st_ai_agent`: đọc tri thức đã duyệt/active và ghi hội thoại ẩn danh.
- `st_ai_ingestion_worker`: cập nhật pipeline tài liệu và document chunks.

Không dùng tài khoản `postgres`, không đưa service-role key vào UI và không cấp quyền đọc bảng `accounts` cho AI Agent.

Nếu Python dùng `supabase-py` thay cho kết nối PostgreSQL trực tiếp, secret key vẫn chỉ được đặt trong môi trường server của Python.
