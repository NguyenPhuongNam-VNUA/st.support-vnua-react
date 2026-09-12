begin;

alter table public.documents
  add column if not exists short_title text,
  add column if not exists document_number text,
  add column if not exists document_type text not null default 'other',
  add column if not exists issuer text,
  add column if not exists issuing_unit text,
  add column if not exists signed_by text,
  add column if not exists signer_title text,
  add column if not exists signed_date date,
  add column if not exists issued_date date,
  add column if not exists published_at timestamptz,
  add column if not exists validity_status text not null default 'unknown',
  add column if not exists revision_number integer not null default 1,
  add column if not exists academic_year text,
  add column if not exists semester text,
  add column if not exists audiences text[] not null default '{}',
  add column if not exists education_levels text[] not null default '{}',
  add column if not exists study_modes text[] not null default '{}',
  add column if not exists faculties text[] not null default '{}',
  add column if not exists programs text[] not null default '{}',
  add column if not exists campuses text[] not null default '{}',
  add column if not exists cohorts text[] not null default '{}',
  add column if not exists source_url text,
  add column if not exists original_filename text,
  add column if not exists markdown_content text,
  add column if not exists markdown_path text,
  add column if not exists markdown_sha256 text,
  add column if not exists markdown_generated_at timestamptz,
  add column if not exists extraction_version text not null default 'legal-md-v1',
  add column if not exists chunking_version text not null default 'legal-semantic-v1',
  add column if not exists parser_used text,
  add column if not exists ocr_page_count integer not null default 0,
  add column if not exists ocr_confidence_avg numeric(5,4),
  add column if not exists ocr_confidence_min numeric(5,4),
  add column if not exists review_status text not null default 'pending',
  add column if not exists reviewed_by bigint,
  add column if not exists reviewed_at timestamptz,
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists metadata_provenance jsonb not null default '{}'::jsonb;

update public.documents
set validity_status = case
  when lower(coalesce(validity, '')) like '%hết%' then 'expired'
  when lower(coalesce(validity, '')) like '%còn%' then 'effective'
  else validity_status
end
where validity_status = 'unknown';

alter table public.document_chunks
  add column if not exists chunk_type text not null default 'text',
  add column if not exists search_text text,
  add column if not exists page_start integer,
  add column if not exists page_end integer,
  add column if not exists part text,
  add column if not exists chapter text,
  add column if not exists section text,
  add column if not exists article text,
  add column if not exists clause text,
  add column if not exists point text,
  add column if not exists semantic_topics text[] not null default '{}',
  add column if not exists keywords text[] not null default '{}',
  add column if not exists entities jsonb not null default '{}'::jsonb,
  add column if not exists markdown_start_offset integer,
  add column if not exists markdown_end_offset integer,
  add column if not exists previous_chunk_id bigint,
  add column if not exists next_chunk_id bigint,
  add column if not exists parent_chunk_id bigint,
  add column if not exists is_complete_semantic_unit boolean not null default true,
  add column if not exists split_reason text not null default 'semantic_boundary',
  add column if not exists contains_ocr boolean not null default false,
  add column if not exists ocr_confidence_min numeric(5,4),
  add column if not exists issued_date date,
  add column if not exists valid_from timestamptz,
  add column if not exists valid_to timestamptz,
  add column if not exists validity_status text not null default 'unknown',
  add column if not exists audiences text[] not null default '{}',
  add column if not exists education_levels text[] not null default '{}',
  add column if not exists study_modes text[] not null default '{}',
  add column if not exists faculties text[] not null default '{}',
  add column if not exists programs text[] not null default '{}',
  add column if not exists cohorts text[] not null default '{}',
  add column if not exists embedding_provider text,
  add column if not exists embedded_at timestamptz,
  add column if not exists chunking_version text not null default 'legal-semantic-v1',
  add column if not exists metadata jsonb not null default '{}'::jsonb;

update public.document_chunks
set page_start = coalesce(page_start, page),
    page_end = coalesce(page_end, page),
    search_text = coalesce(search_text, content)
where page_start is null or page_end is null or search_text is null;

alter table public.questions
  add column if not exists source_article text,
  add column if not exists source_clause text,
  add column if not exists verified_at timestamptz,
  add column if not exists valid_from timestamptz,
  add column if not exists valid_to timestamptz,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create index if not exists documents_effective_lookup_idx
  on public.documents (tenant_id, validity_status, valid_from, valid_to)
  where is_active = true and pipeline_stage = 'ready';

create index if not exists document_chunks_effective_lookup_idx
  on public.document_chunks (tenant_id, validity_status, valid_from, valid_to);

create index if not exists document_chunks_article_lookup_idx
  on public.document_chunks (tenant_id, document_id, article);

create index if not exists document_chunks_topics_idx
  on public.document_chunks using gin (semantic_topics);

create index if not exists document_chunks_keywords_idx
  on public.document_chunks using gin (keywords);

create index if not exists document_chunks_search_fts_idx
  on public.document_chunks using gin (to_tsvector('simple', coalesce(search_text, content)));

commit;
