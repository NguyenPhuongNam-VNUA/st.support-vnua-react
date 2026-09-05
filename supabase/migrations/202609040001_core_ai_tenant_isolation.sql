begin;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'st_ai_agent') then
    create role st_ai_agent nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'st_ai_ingestion_worker') then
    create role st_ai_ingestion_worker nologin;
  end if;
end $$;

alter table public.documents
  add column if not exists tenant_id text not null default 'vnua';
alter table public.questions
  add column if not exists tenant_id text not null default 'vnua';
alter table public.document_chunks
  add column if not exists chunk_index integer default 0,
  add column if not exists tenant_id text not null default 'vnua',
  add column if not exists embedding_model text,
  add column if not exists embedding_dimension integer;
alter table public.questions
  add column if not exists embedding_model text,
  add column if not exists embedding_dimension integer;

alter table public.documents enable row level security;
alter table public.document_chunks enable row level security;
alter table public.questions enable row level security;

create index if not exists documents_tenant_ready_idx
  on public.documents (tenant_id, created_at desc)
  where is_active = true and pipeline_stage = 'ready';
create index if not exists questions_tenant_approved_idx
  on public.questions (tenant_id, created_at desc)
  where status = 'approved';
create index if not exists document_chunks_tenant_document_idx
  on public.document_chunks (tenant_id, document_id, chunk_index);

-- Existing vectors were generated in a different embedding space. They must not
-- be compared with Gemini Embedding 2 query vectors before re-indexing.
update public.document_chunks
set embedding = null, embedding_model = null, embedding_dimension = null
where embedding is not null;
update public.questions
set embedding = null, embedding_model = null, embedding_dimension = null
where embedding is not null;

drop policy if exists documents_ai_read on public.documents;
create policy documents_ai_read on public.documents
  for select to st_ai_agent
  using (tenant_id = nullif(current_setting('app.tenant_id', true), ''));

drop policy if exists document_chunks_ai_read on public.document_chunks;
create policy document_chunks_ai_read on public.document_chunks
  for select to st_ai_agent
  using (tenant_id = nullif(current_setting('app.tenant_id', true), ''));

drop policy if exists questions_ai_read on public.questions;
create policy questions_ai_read on public.questions
  for select to st_ai_agent
  using (
    tenant_id = nullif(current_setting('app.tenant_id', true), '')
    and status = 'approved'
  );

drop policy if exists documents_ai_update on public.documents;
create policy documents_ai_update on public.documents
  for update to st_ai_agent
  using (tenant_id = nullif(current_setting('app.tenant_id', true), ''))
  with check (tenant_id = nullif(current_setting('app.tenant_id', true), ''));

drop policy if exists document_chunks_ai_insert on public.document_chunks;
create policy document_chunks_ai_insert on public.document_chunks
  for insert to st_ai_agent
  with check (tenant_id = nullif(current_setting('app.tenant_id', true), ''));

drop policy if exists document_chunks_ai_update on public.document_chunks;
create policy document_chunks_ai_update on public.document_chunks
  for update to st_ai_agent
  using (tenant_id = nullif(current_setting('app.tenant_id', true), ''))
  with check (tenant_id = nullif(current_setting('app.tenant_id', true), ''));

drop policy if exists questions_ai_insert on public.questions;
create policy questions_ai_insert on public.questions
  for insert to st_ai_agent
  with check (tenant_id = nullif(current_setting('app.tenant_id', true), ''));

drop policy if exists questions_ai_update on public.questions;
create policy questions_ai_update on public.questions
  for update to st_ai_agent
  using (tenant_id = nullif(current_setting('app.tenant_id', true), ''))
  with check (tenant_id = nullif(current_setting('app.tenant_id', true), ''));

commit;
