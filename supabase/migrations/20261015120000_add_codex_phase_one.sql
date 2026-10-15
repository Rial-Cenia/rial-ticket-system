create type public."CodexRunStatus" as enum (
  'IDLE',
  'ANALYZING',
  'WAITING_FOR_USER',
  'ANALYSIS_APPROVED',
  'IMPLEMENTING',
  'VERIFYING',
  'PR_OPENED',
  'FAILED',
  'CANCELLED',
  'EXPIRED'
);

create type public."CodexAnalysisDecision" as enum (
  'ELIGIBLE',
  'NEEDS_CLARIFICATION',
  'OUT_OF_SCOPE'
);

create type public."CodexComplexity" as enum ('LOW', 'MEDIUM', 'HIGH');

create table public."CodexRepositoryPolicy" (
  id uuid primary key default gen_random_uuid(),
  "fullName" text not null unique check ("fullName" ~ '^[^/]+/[^/]+$'),
  "baseBranch" text not null default 'develop',
  "analysisEnabled" boolean not null default true,
  "implementationEnabled" boolean not null default false,
  "allowedPaths" text[] not null default '{}'::text[],
  "forbiddenPaths" text[] not null default '{}'::text[],
  "allowDependencyChanges" boolean not null default false,
  "allowDatabaseChanges" boolean not null default false,
  "maxChangedFiles" integer not null default 30 check ("maxChangedFiles" >= 0),
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create table public."CodexRun" (
  id uuid primary key default gen_random_uuid(),
  "ticketPublicId" uuid not null references public."Ticket"("publicId") on delete cascade,
  status public."CodexRunStatus" not null default 'IDLE',
  "createdByDiscordId" text,
  "createdByUserId" uuid references auth.users(id),
  "repositoryFullName" text references public."CodexRepositoryPolicy"("fullName"),
  "branchName" text,
  "pullRequestUrl" text,
  "sessionId" text,
  "worktreePath" text,
  "lastError" text,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create index "CodexRun_ticket_status_idx"
on public."CodexRun" ("ticketPublicId", status, "createdAt" desc);

create unique index "CodexRun_one_active_per_ticket_idx"
on public."CodexRun" ("ticketPublicId")
where status in (
  'ANALYZING',
  'WAITING_FOR_USER',
  'ANALYSIS_APPROVED',
  'IMPLEMENTING',
  'VERIFYING'
);

create table public."CodexAnalysis" (
  id uuid primary key default gen_random_uuid(),
  "runId" uuid not null references public."CodexRun"(id) on delete cascade,
  decision public."CodexAnalysisDecision" not null,
  complexity public."CodexComplexity" not null,
  confidence numeric(4, 3) not null check (confidence >= 0 and confidence <= 1),
  "ticketTitle" text not null,
  "ticketDescription" text not null,
  "ticketUpdatedAt" timestamptz not null,
  "repositoryCandidates" text[] not null default '{}'::text[],
  "selectedRepository" text references public."CodexRepositoryPolicy"("fullName"),
  scope text[] not null default '{}'::text[],
  checks text[] not null default '{}'::text[],
  risks text[] not null default '{}'::text[],
  questions text[] not null default '{}'::text[],
  "forbiddenChangesDetected" text[] not null default '{}'::text[],
  "approvedAt" timestamptz,
  "createdAt" timestamptz not null default now()
);

create index "CodexAnalysis_run_createdAt_idx"
on public."CodexAnalysis" ("runId", "createdAt" desc);

create table public."CodexConversationMessage" (
  id uuid primary key default gen_random_uuid(),
  "runId" uuid not null references public."CodexRun"(id) on delete cascade,
  "discordMessageId" text not null unique,
  "discordAuthorId" text not null,
  "isBot" boolean not null default false,
  content text not null check (char_length(content) <= 10000),
  attachments jsonb not null default '[]'::jsonb,
  "createdAt" timestamptz not null default now()
);

create index "CodexConversationMessage_run_createdAt_idx"
on public."CodexConversationMessage" ("runId", "createdAt");

create table public."CodexRunEvent" (
  id uuid primary key default gen_random_uuid(),
  "runId" uuid not null references public."CodexRun"(id) on delete cascade,
  event text not null,
  "actorDiscordId" text,
  "actorUserId" uuid references auth.users(id),
  details jsonb not null default '{}'::jsonb,
  "createdAt" timestamptz not null default now()
);

create index "CodexRunEvent_run_createdAt_idx"
on public."CodexRunEvent" ("runId", "createdAt");

create trigger "CodexRepositoryPolicy_set_updated_at"
before update on public."CodexRepositoryPolicy"
for each row execute function public.set_updated_at();

create trigger "CodexRun_set_updated_at"
before update on public."CodexRun"
for each row execute function public.set_updated_at();

alter table public."CodexRepositoryPolicy" enable row level security;
alter table public."CodexRun" enable row level security;
alter table public."CodexAnalysis" enable row level security;
alter table public."CodexConversationMessage" enable row level security;
alter table public."CodexRunEvent" enable row level security;

revoke all on table
  public."CodexRepositoryPolicy",
  public."CodexRun",
  public."CodexAnalysis",
  public."CodexConversationMessage",
  public."CodexRunEvent"
from anon, authenticated;

grant select, insert, update, delete on table
  public."CodexRepositoryPolicy",
  public."CodexRun",
  public."CodexAnalysis",
  public."CodexConversationMessage",
  public."CodexRunEvent"
to service_role;

insert into public."CodexRepositoryPolicy" (
  "fullName",
  "implementationEnabled",
  "allowedPaths",
  "forbiddenPaths",
  "maxChangedFiles"
)
values
  (
    'Rial-Cenia/rial-frontend',
    true,
    array['src/', 'tests/', 'e2e/'],
    array['.env', '.env.*', '.github/', 'supabase/migrations/'],
    30
  ),
  (
    'Rial-Cenia/rial-backend',
    true,
    array['src/', 'test/', 'tests/'],
    array['.env', '.env.*', '.github/', 'prisma/migrations/', 'supabase/migrations/'],
    30
  ),
  (
    'Rial-Cenia/rial-workers',
    true,
    array['src/', 'test/', 'tests/'],
    array['.env', '.env.*', '.github/', 'terraform/', 'infra/', 'deploy/'],
    30
  ),
  (
    'Rial-Cenia/rial-platform-docker',
    false,
    '{}'::text[],
    array['*'],
    0
  );
