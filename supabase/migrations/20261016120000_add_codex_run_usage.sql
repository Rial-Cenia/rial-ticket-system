create table if not exists public."CodexRunUsage" (
  id uuid primary key default gen_random_uuid(),
  "runId" uuid not null references public."CodexRun"(id) on delete cascade,
  phase text not null check (phase in ('PREFLIGHT', 'ANALYSIS', 'IMPLEMENTATION', 'RETRY')),
  "inputTokens" integer not null default 0 check ("inputTokens" >= 0),
  "cachedInputTokens" integer not null default 0 check ("cachedInputTokens" >= 0),
  "outputTokens" integer not null default 0 check ("outputTokens" >= 0),
  "reasoningOutputTokens" integer not null default 0 check ("reasoningOutputTokens" >= 0),
  "totalTokens" integer not null default 0 check ("totalTokens" >= 0),
  "createdAt" timestamptz not null default now()
);

create index if not exists "CodexRunUsage_run_createdAt_idx"
on public."CodexRunUsage" ("runId", "createdAt");

alter table public."CodexRunUsage" enable row level security;

revoke all on table public."CodexRunUsage" from anon, authenticated;
grant select, insert, update, delete on table public."CodexRunUsage" to service_role;
