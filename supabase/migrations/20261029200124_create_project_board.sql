create table public."Project" (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 200),
  status text not null default 'BACKLOG'
    check (status in ('BACKLOG', 'PLANNED', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'CANCELLED')),
  platforms public."Platform"[] not null default '{}',
  urgency public."KanbanPriority" not null default 'MEDIA',
  importance public."KanbanPriority" not null default 'MEDIA',
  "createdByUserId" uuid not null references auth.users(id),
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  check (cardinality(platforms) between 1 and 6)
);

create index "Project_status_updatedAt_idx"
on public."Project" (status, "updatedAt" desc);

create trigger "Project_set_updated_at"
before update on public."Project"
for each row execute function public.set_updated_at();

alter table public."Project" enable row level security;
revoke all on table public."Project" from anon, authenticated;
grant select, insert, update, delete on table public."Project" to service_role;
