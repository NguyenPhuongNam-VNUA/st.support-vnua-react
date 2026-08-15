begin;

create extension if not exists pgcrypto with schema extensions;

-- Bổ sung metadata cần cho API Node.js và pipeline AI.
alter table public.documents
  add column if not exists created_by bigint;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'documents_created_by_fkey'
      and conrelid = 'public.documents'::regclass
  ) then
    alter table public.documents
      add constraint documents_created_by_fkey
      foreign key (created_by) references public.accounts(id) on delete set null;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'documents_progress_check'
      and conrelid = 'public.documents'::regclass
  ) then
    alter table public.documents
      add constraint documents_progress_check check (progress between 0 and 100) not valid;
    alter table public.documents validate constraint documents_progress_check;
  end if;
end $$;

alter table public.document_chunks
  add column if not exists chunk_index integer;

with numbered as (
  select id, row_number() over (partition by document_id order by id) - 1 as chunk_index
  from public.document_chunks
  where chunk_index is null
)
update public.document_chunks as chunks
set chunk_index = numbered.chunk_index
from numbered
where chunks.id = numbered.id;

alter table public.document_chunks alter column document_id set not null;
alter table public.document_chunks alter column chunk_index set not null;

create unique index if not exists document_chunks_document_chunk_unique
  on public.document_chunks(document_id, chunk_index);
create index if not exists documents_created_by_idx on public.documents(created_by);
create unique index if not exists accounts_email_lower_unique on public.accounts(lower(email));
create index if not exists questions_status_created_at_idx
  on public.questions(status, created_at desc);
create index if not exists documents_ready_idx
  on public.documents(created_at desc)
  where is_active = true and pipeline_stage = 'ready';

-- Audit log phải còn tồn tại sau khi câu hỏi bị xóa.
alter table public.question_audit_logs
  drop constraint if exists question_audit_logs_question_id_fkey;
alter table public.question_audit_logs
  add constraint question_audit_logs_question_id_fkey
  foreign key (question_id) references public.questions(id) on delete set null;

drop trigger if exists trg_questions_audit_delete on public.questions;
drop function if exists public.log_question_delete();

create or replace function public.log_question_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.question_audit_logs
    (question_id, action, old_value, new_value, changed_by)
  values
    (new.id, 'create', null, to_jsonb(new) - 'embedding', new.created_by);
  return new;
end;
$$;

create or replace function public.log_question_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.question_audit_logs
    (question_id, action, old_value, new_value, changed_by)
  values
    (
      old.id,
      'update',
      to_jsonb(old) - 'embedding',
      to_jsonb(new) - 'embedding',
      new.updated_by
    );
  return new;
end;
$$;

-- RPC mật khẩu chỉ dành cho backend Node dùng server key.
create or replace function public.hash_password(p_password text)
returns text
language sql
security definer
set search_path = ''
as $$
  select extensions.crypt(p_password, extensions.gen_salt('bf', 12));
$$;

create or replace function public.verify_password(p_input_password text, p_password_hash text)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select extensions.crypt(p_input_password, p_password_hash) = p_password_hash;
$$;

revoke all on function public.hash_password(text) from public, anon, authenticated;
revoke all on function public.verify_password(text, text) from public, anon, authenticated;
grant execute on function public.hash_password(text) to service_role;
grant execute on function public.verify_password(text, text) to service_role;

create or replace function public.get_top_questions(p_limit integer default 5)
returns table(content text, freq bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select messages.content, count(*)::bigint as freq
  from public.messages
  where messages.sender = 'user'
  group by messages.content
  order by freq desc
  limit least(greatest(p_limit, 1), 20);
$$;

revoke all on function public.get_top_questions(integer) from public, anon, authenticated;
grant execute on function public.get_top_questions(integer) to service_role;

-- Browser không truy cập Data API trực tiếp. Node service_role là cổng dữ liệu duy nhất.
alter table public.accounts enable row level security;
alter table public.documents enable row level security;
alter table public.document_chunks enable row level security;
alter table public.questions enable row level security;
alter table public.question_audit_logs enable row level security;
alter table public.agents enable row level security;
alter table public.app_settings enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;

revoke all on table
  public.accounts,
  public.documents,
  public.document_chunks,
  public.questions,
  public.question_audit_logs,
  public.agents,
  public.app_settings,
  public.conversations,
  public.messages
from anon, authenticated;
revoke all on table public.top_questions from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

grant select, insert, update, delete on table
  public.accounts,
  public.documents,
  public.document_chunks,
  public.questions,
  public.question_audit_logs,
  public.agents,
  public.app_settings,
  public.conversations,
  public.messages
to service_role;
grant select on table public.top_questions to service_role;
grant usage, select on all sequences in schema public to service_role;

-- Hai group role tối thiểu cho Python AI trong tương lai.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'st_ai_agent') then
    create role st_ai_agent nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'st_ai_ingestion_worker') then
    create role st_ai_ingestion_worker nologin;
  end if;
end $$;

grant usage on schema public to st_ai_agent, st_ai_ingestion_worker;
grant select on public.documents, public.document_chunks, public.questions,
  public.agents, public.app_settings to st_ai_agent;
grant select, insert on public.conversations, public.messages to st_ai_agent;
grant usage, select on sequence public.conversations_id_seq, public.messages_id_seq to st_ai_agent;

grant select, update on public.documents to st_ai_ingestion_worker;
grant select, insert, update, delete on public.document_chunks to st_ai_ingestion_worker;
grant usage, select on sequence public.document_chunks_id_seq to st_ai_ingestion_worker;

drop policy if exists documents_ai_read on public.documents;
create policy documents_ai_read on public.documents
  for select to st_ai_agent
  using (is_active = true and pipeline_stage = 'ready');

drop policy if exists document_chunks_ai_read on public.document_chunks;
create policy document_chunks_ai_read on public.document_chunks
  for select to st_ai_agent
  using (
    exists (
      select 1 from public.documents
      where documents.id = document_chunks.document_id
        and documents.is_active = true
        and documents.pipeline_stage = 'ready'
    )
  );

drop policy if exists questions_ai_read on public.questions;
create policy questions_ai_read on public.questions
  for select to st_ai_agent using (status = 'approved');

drop policy if exists agents_ai_read on public.agents;
create policy agents_ai_read on public.agents
  for select to st_ai_agent using (status = 'Active');

drop policy if exists app_settings_ai_read on public.app_settings;
create policy app_settings_ai_read on public.app_settings
  for select to st_ai_agent using (true);

drop policy if exists conversations_ai_read on public.conversations;
create policy conversations_ai_read on public.conversations
  for select to st_ai_agent using (account_id is null);
drop policy if exists conversations_ai_insert on public.conversations;
create policy conversations_ai_insert on public.conversations
  for insert to st_ai_agent with check (account_id is null);

drop policy if exists messages_ai_read on public.messages;
create policy messages_ai_read on public.messages
  for select to st_ai_agent
  using (
    exists (
      select 1 from public.conversations
      where conversations.id = messages.conversation_id
        and conversations.account_id is null
    )
  );
drop policy if exists messages_ai_insert on public.messages;
create policy messages_ai_insert on public.messages
  for insert to st_ai_agent
  with check (
    exists (
      select 1 from public.conversations
      where conversations.id = messages.conversation_id
        and conversations.account_id is null
    )
  );

drop policy if exists documents_ingestion_read on public.documents;
create policy documents_ingestion_read on public.documents
  for select to st_ai_ingestion_worker using (true);
drop policy if exists documents_ingestion_update on public.documents;
create policy documents_ingestion_update on public.documents
  for update to st_ai_ingestion_worker using (true) with check (true);
drop policy if exists chunks_ingestion_all on public.document_chunks;
create policy chunks_ingestion_all on public.document_chunks
  for all to st_ai_ingestion_worker using (true) with check (true);

-- Bucket PDF luôn private; server tạo signed URL ngắn hạn khi admin xem file.
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do update set public = false;

commit;
