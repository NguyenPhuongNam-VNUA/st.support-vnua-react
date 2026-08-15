# ST Support VNUA

Ứng dụng hỗ trợ sinh viên và quản trị kho tri thức RAG của Khoa Công nghệ thông tin VNUA.

## Kiến trúc

```text
Next.js UI
  -> Next.js Route Handlers (Node.js)
     -> JWT jose + RBAC
     -> Supabase PostgreSQL / Storage

Next.js /api/chat
  -> Python AI Agent nội bộ (tùy chọn)
     -> Supabase PostgreSQL + pgvector
```

Laravel đã được loại bỏ. Trình duyệt không gọi trực tiếp Supabase bằng server key và cũng không gọi trực tiếp Python AI Agent.

## Xác thực và phân quyền

- JWT được ký/xác minh bằng `jose`.
- JWT nằm trong cookie `st_session` với `HttpOnly`, `SameSite=Lax`, `Secure` ở production.
- Vai trò hiện tại: `admin` và `student`.
- `/admin/**` và `/api/admin/**` chỉ dành cho admin.
- Route Handler luôn kiểm tra lại tài khoản `is_active` và `role` trong PostgreSQL.
- Token không được lưu trong `localStorage`.

## Cấu hình môi trường

Sao chép `.env.example` thành `.env` và điền giá trị thật:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SECRET_KEY=server-only-secret
JWT_SECRET=at-least-32-random-bytes
JWT_ISSUER=st-care
JWT_AUDIENCE=st-care-web

# Chỉ cần khi có Python AI Agent
PYTHON_AGENT_BASE_URL=http://127.0.0.1:5001
AI_AGENT_SERVICE_TOKEN=internal-service-token
```

Không đặt `SUPABASE_SECRET_KEY`, `JWT_SECRET` hoặc `AI_AGENT_SERVICE_TOKEN` trong biến có tiền tố `NEXT_PUBLIC_`.

## Cơ sở dữ liệu

- Cài mới: chạy `mocks/DB.sql`, sau đó chạy migration trong `supabase/migrations`.
- Database đã tồn tại: chỉ chạy migration theo thứ tự trong `supabase/migrations`.
- Bucket `documents` được đặt private; API tạo signed URL ngắn hạn khi admin xem PDF.
- RLS được bật và quyền `anon`/`authenticated` bị thu hồi cho các bảng nội bộ.
- Node.js dùng server key sau khi đã kiểm tra JWT/RBAC.
- Hai group role `st_ai_agent` và `st_ai_ingestion_worker` chuẩn bị sẵn quyền tối thiểu cho Python.

Migration hiện tại:

```text
supabase/migrations/202608150001_node_supabase_security.sql
```

## API chính

### Authentication

- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/logout`

### Admin

- `/api/admin/accounts`
- `/api/admin/documents`
- `/api/admin/documents/[id]/chunks`
- `/api/admin/documents/[id]/embed`
- `/api/admin/questions`
- `/api/admin/questions/bulk`
- `/api/admin/questions/import`
- `/api/admin/questions/top`
- `/api/admin/conversations`

### AI gateway

- `POST /api/chat`

Chi tiết hợp đồng tích hợp Python nằm tại `docs/python-ai-agent-contract.md`.

## Chạy dự án

```bash
npm install
npm run dev
```

Kiểm tra trước khi phát hành:

```bash
npx tsc --noEmit
npm run build
```
