alter table public."Kanban"
add column code text;

do $$
declare
  kanban_row record;
  generated_code text;
begin
  for kanban_row in
    select id
    from public."Kanban"
    where code is null
    order by "createdAt", id
  loop
    loop
      generated_code :=
        substr('ABCDEFGHJKLMNPQRSTUVWXYZ', floor(random() * 24)::integer + 1, 1) ||
        substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', floor(random() * 32)::integer + 1, 1) ||
        substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', floor(random() * 32)::integer + 1, 1) ||
        substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', floor(random() * 32)::integer + 1, 1);
      exit when not exists (
        select 1
        from public."Kanban"
        where lower(code) = lower(generated_code)
      );
    end loop;

    update public."Kanban"
    set code = generated_code
    where id = kanban_row.id;
  end loop;
end;
$$;

alter table public."Kanban"
alter column code set not null,
add constraint "Kanban_code_format_check"
check (code ~ '^[A-Z][A-Z0-9]{1,9}$');

create unique index "Kanban_code_key"
on public."Kanban" (lower(code));

alter table public."KanbanCard"
add column number integer;

with numbered_cards as (
  select
    id,
    row_number() over (
      partition by "kanbanId"
      order by "createdAt", id
    )::integer as card_number
  from public."KanbanCard"
)
update public."KanbanCard" card
set number = numbered_cards.card_number
from numbered_cards
where card.id = numbered_cards.id;

alter table public."KanbanCard"
alter column number set not null,
add constraint "KanbanCard_number_check"
check (number > 0);

create unique index "KanbanCard_kanbanId_number_key"
on public."KanbanCard" ("kanbanId", number);

create or replace function public.assign_kanban_card_number()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.number is null then
    perform pg_advisory_xact_lock(hashtextextended(new."kanbanId"::text, 0));
    select coalesce(max(number), 0) + 1
    into new.number
    from public."KanbanCard"
    where "kanbanId" = new."kanbanId";
  end if;
  return new;
end;
$$;

revoke all on function public.assign_kanban_card_number() from public, anon, authenticated;

create trigger "KanbanCard_assign_number"
before insert on public."KanbanCard"
for each row execute function public.assign_kanban_card_number();

create table public."GithubOrganization" (
  id uuid primary key default gen_random_uuid(),
  login text not null,
  "installationId" bigint not null,
  status public."RecordStatus" not null default 'ACTIVE',
  "createdByUserId" uuid not null references auth.users(id),
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create unique index "GithubOrganization_login_key"
on public."GithubOrganization" (lower(login));
create unique index "GithubOrganization_installationId_key"
on public."GithubOrganization" ("installationId");

create table public."GithubRepository" (
  id uuid primary key default gen_random_uuid(),
  "githubId" bigint not null,
  "organizationId" uuid not null references public."GithubOrganization"(id),
  owner text not null,
  name text not null,
  "fullName" text not null,
  "htmlUrl" text not null,
  "defaultBranch" text,
  status public."RecordStatus" not null default 'ACTIVE',
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create unique index "GithubRepository_githubId_key"
on public."GithubRepository" ("githubId");
create index "GithubRepository_organization_idx"
on public."GithubRepository" ("organizationId", status, "fullName");

create table public."TeamGithubRepository" (
  id uuid primary key default gen_random_uuid(),
  "teamId" uuid not null references public."Team"(id),
  "repositoryId" uuid not null references public."GithubRepository"(id),
  status public."RecordStatus" not null default 'ACTIVE',
  "createdByUserId" uuid not null references auth.users(id),
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create unique index "TeamGithubRepository_active_key"
on public."TeamGithubRepository" ("teamId", "repositoryId")
where status = 'ACTIVE';
create index "TeamGithubRepository_repository_idx"
on public."TeamGithubRepository" ("repositoryId", status);

create table public."KanbanGithubRepository" (
  id uuid primary key default gen_random_uuid(),
  "kanbanId" uuid not null references public."Kanban"(id),
  "repositoryId" uuid not null references public."GithubRepository"(id),
  status public."RecordStatus" not null default 'ACTIVE',
  "createdByUserId" uuid not null references auth.users(id),
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create unique index "KanbanGithubRepository_active_key"
on public."KanbanGithubRepository" ("kanbanId", "repositoryId")
where status = 'ACTIVE';
create index "KanbanGithubRepository_repository_idx"
on public."KanbanGithubRepository" ("repositoryId", status);

create table public."GithubPullRequest" (
  id uuid primary key default gen_random_uuid(),
  "repositoryId" uuid not null references public."GithubRepository"(id),
  "githubId" bigint not null,
  number integer not null check (number > 0),
  title text not null,
  state text not null check (state in ('OPEN', 'CLOSED', 'MERGED')),
  "isDraft" boolean not null default false,
  "authorLogin" text,
  url text not null,
  "githubCreatedAt" timestamptz,
  "githubUpdatedAt" timestamptz,
  "githubClosedAt" timestamptz,
  "githubMergedAt" timestamptz,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create unique index "GithubPullRequest_repository_number_key"
on public."GithubPullRequest" ("repositoryId", number);
create unique index "GithubPullRequest_githubId_key"
on public."GithubPullRequest" ("githubId");

create table public."KanbanCardGithubPullRequest" (
  id uuid primary key default gen_random_uuid(),
  "cardId" uuid not null references public."KanbanCard"(id) on delete cascade,
  "pullRequestId" uuid not null references public."GithubPullRequest"(id) on delete cascade,
  status public."RecordStatus" not null default 'ACTIVE',
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create unique index "KanbanCardGithubPullRequest_active_key"
on public."KanbanCardGithubPullRequest" ("cardId", "pullRequestId")
where status = 'ACTIVE';
create index "KanbanCardGithubPullRequest_card_idx"
on public."KanbanCardGithubPullRequest" ("cardId", status);
create index "KanbanCardGithubPullRequest_pr_idx"
on public."KanbanCardGithubPullRequest" ("pullRequestId", status);

create table public."GithubPullRequestActivity" (
  id uuid primary key default gen_random_uuid(),
  "pullRequestId" uuid not null references public."GithubPullRequest"(id) on delete cascade,
  event text not null,
  "actorLogin" text,
  changes jsonb not null default '{}'::jsonb,
  "createdAt" timestamptz not null default now()
);

create index "GithubPullRequestActivity_pr_idx"
on public."GithubPullRequestActivity" ("pullRequestId", "createdAt" desc);

create table public."GithubWebhookDelivery" (
  id uuid primary key default gen_random_uuid(),
  "deliveryId" text not null unique,
  event text not null,
  payload jsonb not null,
  "processedAt" timestamptz,
  "createdAt" timestamptz not null default now()
);

create trigger "GithubOrganization_set_updated_at"
before update on public."GithubOrganization"
for each row execute function public.set_updated_at();
create trigger "GithubRepository_set_updated_at"
before update on public."GithubRepository"
for each row execute function public.set_updated_at();
create trigger "TeamGithubRepository_set_updated_at"
before update on public."TeamGithubRepository"
for each row execute function public.set_updated_at();
create trigger "KanbanGithubRepository_set_updated_at"
before update on public."KanbanGithubRepository"
for each row execute function public.set_updated_at();
create trigger "GithubPullRequest_set_updated_at"
before update on public."GithubPullRequest"
for each row execute function public.set_updated_at();
create trigger "KanbanCardGithubPullRequest_set_updated_at"
before update on public."KanbanCardGithubPullRequest"
for each row execute function public.set_updated_at();

alter table public."GithubOrganization" enable row level security;
alter table public."GithubRepository" enable row level security;
alter table public."TeamGithubRepository" enable row level security;
alter table public."KanbanGithubRepository" enable row level security;
alter table public."GithubPullRequest" enable row level security;
alter table public."KanbanCardGithubPullRequest" enable row level security;
alter table public."GithubPullRequestActivity" enable row level security;
alter table public."GithubWebhookDelivery" enable row level security;

revoke all on table
  public."GithubOrganization",
  public."GithubRepository",
  public."TeamGithubRepository",
  public."KanbanGithubRepository",
  public."GithubPullRequest",
  public."KanbanCardGithubPullRequest",
  public."GithubPullRequestActivity",
  public."GithubWebhookDelivery"
from anon, authenticated;

grant select, insert, update, delete on table
  public."GithubOrganization",
  public."GithubRepository",
  public."TeamGithubRepository",
  public."KanbanGithubRepository",
  public."GithubPullRequest",
  public."KanbanCardGithubPullRequest",
  public."GithubPullRequestActivity",
  public."GithubWebhookDelivery"
to service_role;

drop function public.create_kanban(text, uuid[], uuid);

create or replace function public.create_kanban(
  p_name text,
  p_code text,
  p_team_ids uuid[],
  p_actor_id uuid
)
returns public."Kanban"
language plpgsql
security invoker
set search_path = ''
as $$
declare created public."Kanban";
begin
  if coalesce(array_length(p_team_ids, 1), 0) = 0 then
    raise exception 'El kanban debe estar asignado al menos a un equipo';
  end if;
  if p_code !~ '^[A-Z][A-Z0-9]{1,9}$' then
    raise exception 'Código de kanban inválido';
  end if;

  insert into public."Kanban" (name, code, "createdByUserId")
  values (p_name, p_code, p_actor_id)
  returning * into created;

  insert into public."KanbanTeam" ("kanbanId", "teamId")
  select created.id, team_id
  from unnest(p_team_ids) team_id
  join public."Team" team on team.id = team_id and team.status = 'ACTIVE';

  if (select count(*) from public."KanbanTeam" where "kanbanId" = created.id) <> array_length(p_team_ids, 1) then
    raise exception 'Uno o más equipos no están disponibles';
  end if;

  insert into public."KanbanState" ("kanbanId", name, position)
  values
    (created.id, 'Por hacer', 0),
    (created.id, 'En progreso', 1),
    (created.id, 'Listo', 2);

  return created;
exception
  when unique_violation then
    raise exception 'El código de kanban ya está en uso';
end;
$$;

revoke all on function public.create_kanban(text, text, uuid[], uuid)
from public, anon, authenticated;
grant execute on function public.create_kanban(text, text, uuid[], uuid)
to service_role;

create or replace function public.create_kanban(
  p_name text,
  p_team_ids uuid[],
  p_actor_id uuid
)
returns public."Kanban"
language plpgsql
security invoker
set search_path = ''
as $$
declare
  generated_code text;
begin
  loop
    generated_code :=
      substr('ABCDEFGHJKLMNPQRSTUVWXYZ', floor(random() * 24)::integer + 1, 1) ||
      substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', floor(random() * 32)::integer + 1, 1) ||
      substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', floor(random() * 32)::integer + 1, 1) ||
      substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', floor(random() * 32)::integer + 1, 1);
    exit when not exists (
      select 1
      from public."Kanban"
      where lower(code) = lower(generated_code)
    );
  end loop;
  return public.create_kanban(p_name, generated_code, p_team_ids, p_actor_id);
end;
$$;

revoke all on function public.create_kanban(text, uuid[], uuid)
from public, anon, authenticated;
grant execute on function public.create_kanban(text, uuid[], uuid)
to service_role;
