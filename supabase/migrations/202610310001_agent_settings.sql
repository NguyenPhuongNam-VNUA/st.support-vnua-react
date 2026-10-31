begin;

-- Admin-editable runtime settings for the answer agent. NULL means "use the
-- core-ai environment default", so an empty row changes nothing.
create table if not exists public.agent_settings (
  tenant_id text primary key,
  system_prompt text check (system_prompt is null or char_length(system_prompt) between 1 and 8000),
  llm_model text check (llm_model is null or llm_model ~ '^[A-Za-z0-9._:/-]{1,120}$'),
  temperature numeric(3, 2) check (temperature is null or temperature between 0 and 1),
  evidence_low_threshold numeric(3, 2)
    check (evidence_low_threshold is null or evidence_low_threshold between 0.30 and 0.75),
  updated_by bigint,
  updated_at timestamptz not null default now()
);

alter table public.agent_settings enable row level security;

drop policy if exists agent_settings_read on public.agent_settings;
create policy agent_settings_read on public.agent_settings
  for select to st_ai_agent
  using (tenant_id = nullif(current_setting('app.tenant_id', true), ''));

grant select on public.agent_settings to st_ai_agent;

commit;
