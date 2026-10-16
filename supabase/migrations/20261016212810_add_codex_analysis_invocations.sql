create table public."CodexAnalysisInvocation" (
  id uuid primary key default gen_random_uuid(),
  "analysisId" uuid not null references public."CodexAnalysis"(id) on delete cascade,
  source text not null check (source in ('AI', 'DETERMINISTIC_GUARDRAIL', 'DETERMINISTIC_FALLBACK')),
  model text,
  "promptVersion" text,
  "latencyMs" integer check ("latencyMs" >= 0),
  "fallbackReason" text,
  response jsonb not null default '{}'::jsonb,
  "createdAt" timestamptz not null default now()
);

create index "CodexAnalysisInvocation_analysis_createdAt_idx"
on public."CodexAnalysisInvocation" ("analysisId", "createdAt" desc);

alter table public."CodexAnalysisInvocation" enable row level security;

revoke all on table public."CodexAnalysisInvocation" from anon, authenticated;

grant select, insert, update, delete on table public."CodexAnalysisInvocation" to service_role;
