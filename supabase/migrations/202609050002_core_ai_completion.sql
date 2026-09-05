begin;

alter table public.documents
  add column if not exists content_sha256 text,
  add column if not exists knowledge_version bigint not null default 1,
  add column if not exists ingestion_quality numeric(5,4),
  add column if not exists embedding_model text,
  add column if not exists embedding_dimension integer,
  add column if not exists source_trust numeric(5,4) not null default 0.80,
  add column if not exists valid_from timestamptz,
  add column if not exists valid_to timestamptz;

alter table public.document_chunks
  add column if not exists content_hash text,
  add column if not exists heading_path jsonb not null default '[]'::jsonb,
  add column if not exists parser_used text,
  add column if not exists ocr_confidence numeric(5,4),
  add column if not exists knowledge_version bigint not null default 1;

create index if not exists document_chunks_content_hash_idx
  on public.document_chunks (tenant_id, content_hash, embedding_model, embedding_dimension);
create index if not exists document_chunks_fts_simple_idx
  on public.document_chunks using gin (to_tsvector('simple', content));

create table if not exists public.ai_knowledge_versions (
  tenant_id text primary key,
  version bigint not null default 1,
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_topic_anchors (
  tenant_id text not null,
  topic text not null,
  embedding vector(1024) not null,
  embedding_model text not null,
  embedding_dimension integer not null check (embedding_dimension = 1024),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, topic, embedding_model, embedding_dimension)
);

alter table public.ai_knowledge_versions enable row level security;
alter table public.ai_topic_anchors enable row level security;

drop policy if exists ai_knowledge_versions_read on public.ai_knowledge_versions;
create policy ai_knowledge_versions_read on public.ai_knowledge_versions
  for select to st_ai_agent
  using (tenant_id = nullif(current_setting('app.tenant_id', true), ''));

drop policy if exists ai_topic_anchors_read on public.ai_topic_anchors;
create policy ai_topic_anchors_read on public.ai_topic_anchors
  for select to st_ai_agent
  using (tenant_id = nullif(current_setting('app.tenant_id', true), ''));

grant select on public.ai_knowledge_versions, public.ai_topic_anchors to st_ai_agent;
grant select, insert, update on public.ai_knowledge_versions, public.ai_topic_anchors
  to st_ai_ingestion_worker;

commit;
