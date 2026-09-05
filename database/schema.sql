-- ============================================
-- EXTENSIONS
-- ============================================
create extension if not exists vector;
create extension if not exists pg_trgm;
create extension if not exists pgcrypto with schema extensions;
-- pg_cron cần bật thủ công ở Database > Extensions nếu muốn dùng lệnh refresh tự động ở cuối file

-- ============================================
-- NHÓM 1: TÀI KHOẢN & PHÂN QUYỀN
-- ============================================
create type account_role as enum ('admin', 'student');

create table accounts (
  id bigint generated always as identity primary key,
  email text unique not null,
  password_hash text not null,
  full_name text,
  role account_role not null default 'student',
  is_active boolean default true,
  created_at timestamptz default now()
);

-- ============================================
-- NHÓM 2: TÀI LIỆU & RAG
-- ============================================
create table documents (
  id bigint generated always as identity primary key,
  title text not null,
  description text,
  version text default 'v1.0',
  is_active boolean default true,
  validity text,
  pipeline_stage text default 'uploading'
    check (pipeline_stage in ('uploading','chunking','embedding','ready','error')),
  progress int default 0,
  file_path text not null,
  created_by bigint references accounts(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- mistral-embed-2312 trả về vector 1024 chiều
create table document_chunks (
  id bigint generated always as identity primary key,
  document_id bigint references documents(id) on delete cascade,
  chunk_index int not null,
  page int,
  tokens int,
  content text not null,
  embedding vector(1024),
  created_at timestamptz default now()
);

create unique index idx_document_chunks_document_chunk on document_chunks(document_id, chunk_index);

-- HNSW: không cần "train" như ivfflat, phù hợp khi DB còn ít/chưa có dữ liệu
create index idx_document_chunks_embedding
  on document_chunks using hnsw (embedding vector_cosine_ops);

-- ============================================
-- NHÓM 3: NGÂN HÀNG CÂU HỎI (tách riêng audit log)
-- ============================================
create table questions (
  id bigint generated always as identity primary key,
  question text not null,
  answer text,
  topic text check (topic in ('Học vụ','Học phí','Ký túc xá','Tuyển sinh','Bảo lưu','Đồ án','Khác')),
  status text default 'pending' check (status in ('pending','approved','rejected','needs_edit')),
  duplicate_score numeric default 0,
  -- So trùng lặp là question-vs-question (xem SideBySideDuplicateModal)
  duplicate_of_question_id bigint references questions(id),
  -- Liên kết tới tài liệu nguồn nếu câu trả lời được trích từ 1 document cụ thể
  source_document_id bigint references documents(id),
  embedding vector(1024),
  created_by bigint references accounts(id),
  updated_by bigint references accounts(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint chk_questions_not_self_duplicate
    check (duplicate_of_question_id is distinct from id)
);

create index idx_questions_embedding
  on questions using hnsw (embedding vector_cosine_ops);

create table question_audit_logs (
  id bigint generated always as identity primary key,
  question_id bigint references questions(id) on delete set null,
  action text not null,
  old_value jsonb,
  new_value jsonb,
  changed_by bigint references accounts(id),
  created_at timestamptz default now()
);

-- ============================================
-- NHÓM 4: CẤU HÌNH AGENT (API key KHÔNG lưu ở đây)
-- ============================================
create table agents (
  id text primary key,                   -- 'academic' | 'tuition' | 'dormitory' | 'admissions'
                                          -- giữ text vì đây là mã định danh nghiệp vụ, không phải ID tự tăng
  name text not null,
  model text not null,                   -- 'gemini-1.5-flash' | 'gemini-1.5-pro' | ...
  kb_document_id bigint references documents(id),
  system_prompt text not null,
  temperature numeric default 0.2,
  confidence_threshold numeric default 0.75,   -- ngưỡng tự tin để fallback
  status text default 'Active' check (status in ('Active','Inactive')),
  api_key_env_name text not null,        -- chỉ tên biến, không phải giá trị
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table app_settings (
  key text primary key,
  value jsonb not null                   -- default_model, embedding_model, strict_scope, enable_multi_agent...
);

-- ============================================
-- NHÓM 5: HỘI THOẠI & LOG
-- ============================================
create table conversations (
  id bigint generated always as identity primary key,
  account_id bigint references accounts(id),   -- null nếu hỏi ẩn danh
  started_at timestamptz default now(),
  ended_at timestamptz
);

create table messages (
  id bigint generated always as identity primary key,
  conversation_id bigint references conversations(id) on delete cascade,
  sender text not null check (sender in ('user','bot')),
  content text not null,
  agent_id text references agents(id),
  retrieved_chunk_ids bigint[],
  status text check (status in ('answered','not_found','auto_generated','out_of_topic')),
  confidence_score numeric,
  feedback text check (feedback in ('like','dislike')),
  rating smallint check (rating between 1 and 5),
  created_at timestamptz default now()
);

-- ============================================
-- INDEX CHO KHÓA NGOẠI (Postgres không tự tạo)
-- ============================================
create index idx_questions_duplicate_of on questions(duplicate_of_question_id);
create index idx_questions_source_document on questions(source_document_id);
create index idx_questions_created_by on questions(created_by);
create index idx_questions_updated_by on questions(updated_by);

create index idx_question_audit_logs_question_id on question_audit_logs(question_id);
create index idx_question_audit_logs_changed_by on question_audit_logs(changed_by);

create index idx_agents_kb_document_id on agents(kb_document_id);

create index idx_conversations_account_id on conversations(account_id);

create index idx_messages_conversation_id on messages(conversation_id);
create index idx_messages_agent_id on messages(agent_id);
create index idx_messages_status on messages(status) where sender = 'bot';

-- ============================================
-- INDEX PHỤC VỤ BỘ LỌC HAY DÙNG
-- ============================================
create index idx_questions_topic_status on questions(topic, status);
create index idx_documents_active_stage on documents(is_active, pipeline_stage);

-- BRIN nhẹ hơn B-tree cho cột thời gian tăng dần trên bảng lớn (append-only)
create index idx_messages_created_at on messages using brin(created_at);
create index idx_conversations_started_at on conversations using brin(started_at);

-- Tìm kiếm gần đúng (ILIKE '%từ khóa%') trên ô search
create index idx_questions_question_trgm on questions using gin (question gin_trgm_ops);
create index idx_documents_title_trgm on documents using gin (title gin_trgm_ops);

-- ============================================
-- TRIGGER: TỰ ĐỘNG SET updated_at
-- ============================================
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_documents_updated_at
before update on documents
for each row execute function set_updated_at();

create trigger trg_questions_updated_at
before update on questions
for each row execute function set_updated_at();

create trigger trg_agents_updated_at
before update on agents
for each row execute function set_updated_at();

-- ============================================
-- TRIGGER: TỰ ĐỘNG GHI AUDIT LOG (create / update)
-- Actor lấy từ created_by/updated_by do API Node.js đã xác thực JWT truyền xuống.
-- ============================================
create or replace function log_question_insert() returns trigger as $$
begin
  insert into question_audit_logs (question_id, action, old_value, new_value, changed_by)
  values (new.id, 'create', null, to_jsonb(new),
          new.created_by);
  return new;
end;
$$ language plpgsql;

create trigger trg_questions_audit_insert
after insert on questions
for each row execute function log_question_insert();

create or replace function log_question_change() returns trigger as $$
begin
  insert into question_audit_logs (question_id, action, old_value, new_value, changed_by)
  values (old.id, 'update', to_jsonb(old), to_jsonb(new),
          new.updated_by);
  return new;
end;
$$ language plpgsql;

create trigger trg_questions_audit
after update on questions
for each row execute function log_question_change();

-- Audit khi xóa được API Node.js ghi sau khi đã lưu snapshot old_value.

-- ============================================
-- MATERIALIZED VIEW: TOP 5 CÂU HỎI HAY GẶP
-- (thay cho view thường để tránh GROUP BY toàn bảng mỗi lần load Dashboard)
-- ============================================
create materialized view top_questions as
select content, count(*) as freq
from messages
where sender = 'user'
group by content
order by freq desc
limit 5;

create unique index idx_top_questions_content on top_questions(content);

-- Tùy chọn: tự động refresh mỗi 15 phút (cần bật extension pg_cron trước)
-- select cron.schedule('refresh_top_questions', '*/15 * * * *',
--   $$ refresh materialized view concurrently top_questions $$);
