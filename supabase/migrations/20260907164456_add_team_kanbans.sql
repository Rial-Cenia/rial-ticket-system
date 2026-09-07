create type public."AppRole" as enum ('ADMIN', 'USER');
create type public."RecordStatus" as enum ('ACTIVE', 'CANCELLED');
create type public."TeamMembershipRole" as enum ('LEADER', 'MEMBER');
create type public."KanbanPriority" as enum ('BAJA', 'MEDIA', 'ALTA', 'CRITICA');

create table public."AppUser" (
  "userId" uuid primary key references auth.users(id) on delete cascade,
  role public."AppRole" not null default 'USER',
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

insert into public."AppUser" ("userId")
select id from auth.users
on conflict ("userId") do nothing;

create table public."Team" (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 100),
  status public."RecordStatus" not null default 'ACTIVE',
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create unique index "Team_active_name_key"
on public."Team" (lower(name)) where status = 'ACTIVE';

create table public."TeamMembership" (
  id uuid primary key default gen_random_uuid(),
  "teamId" uuid not null references public."Team"(id),
  "userId" uuid not null references auth.users(id),
  role public."TeamMembershipRole" not null default 'MEMBER',
  status public."RecordStatus" not null default 'ACTIVE',
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create unique index "TeamMembership_active_user_key"
on public."TeamMembership" ("teamId", "userId") where status = 'ACTIVE';
create index "TeamMembership_user_idx"
on public."TeamMembership" ("userId", status);

create table public."Kanban" (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 100),
  status public."RecordStatus" not null default 'ACTIVE',
  "createdByUserId" uuid not null references auth.users(id),
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create table public."KanbanTeam" (
  id uuid primary key default gen_random_uuid(),
  "kanbanId" uuid not null references public."Kanban"(id),
  "teamId" uuid not null references public."Team"(id),
  status public."RecordStatus" not null default 'ACTIVE',
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create unique index "KanbanTeam_active_key"
on public."KanbanTeam" ("kanbanId", "teamId") where status = 'ACTIVE';
create index "KanbanTeam_team_idx" on public."KanbanTeam" ("teamId", status);

create table public."KanbanState" (
  id uuid primary key default gen_random_uuid(),
  "kanbanId" uuid not null references public."Kanban"(id),
  name text not null check (char_length(name) between 1 and 80),
  position integer not null check (position >= 0),
  status public."RecordStatus" not null default 'ACTIVE',
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  unique (id, "kanbanId")
);

create unique index "KanbanState_active_name_key"
on public."KanbanState" ("kanbanId", lower(name)) where status = 'ACTIVE';
create index "KanbanState_order_idx"
on public."KanbanState" ("kanbanId", status, position);

create table public."KanbanTag" (
  id uuid primary key default gen_random_uuid(),
  "kanbanId" uuid not null references public."Kanban"(id),
  name text not null check (char_length(name) between 1 and 50),
  status public."RecordStatus" not null default 'ACTIVE',
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  unique (id, "kanbanId")
);

create unique index "KanbanTag_active_name_key"
on public."KanbanTag" ("kanbanId", lower(name)) where status = 'ACTIVE';

create table public."KanbanCard" (
  id uuid primary key default gen_random_uuid(),
  "kanbanId" uuid not null references public."Kanban"(id),
  title text not null check (char_length(title) between 1 and 200),
  description text not null default '',
  "stateId" uuid not null,
  priority public."KanbanPriority" not null default 'MEDIA',
  "assigneeUserId" uuid references auth.users(id),
  "reviewerUserId" uuid references auth.users(id),
  status public."RecordStatus" not null default 'ACTIVE',
  "createdByUserId" uuid not null references auth.users(id),
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  unique (id, "kanbanId"),
  foreign key ("stateId", "kanbanId") references public."KanbanState"(id, "kanbanId")
);

create index "KanbanCard_board_state_idx"
on public."KanbanCard" ("kanbanId", status, "stateId", "updatedAt" desc);
create index "KanbanCard_assignee_idx"
on public."KanbanCard" ("assigneeUserId") where status = 'ACTIVE';

create table public."KanbanCardTag" (
  id uuid primary key default gen_random_uuid(),
  "kanbanId" uuid not null references public."Kanban"(id),
  "cardId" uuid not null references public."KanbanCard"(id),
  "tagId" uuid not null references public."KanbanTag"(id),
  status public."RecordStatus" not null default 'ACTIVE',
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  foreign key ("cardId", "kanbanId") references public."KanbanCard"(id, "kanbanId"),
  foreign key ("tagId", "kanbanId") references public."KanbanTag"(id, "kanbanId")
);

create unique index "KanbanCardTag_active_key"
on public."KanbanCardTag" ("cardId", "tagId") where status = 'ACTIVE';

create trigger "AppUser_set_updated_at" before update on public."AppUser"
for each row execute function public.set_updated_at();
create trigger "Team_set_updated_at" before update on public."Team"
for each row execute function public.set_updated_at();
create trigger "TeamMembership_set_updated_at" before update on public."TeamMembership"
for each row execute function public.set_updated_at();
create trigger "Kanban_set_updated_at" before update on public."Kanban"
for each row execute function public.set_updated_at();
create trigger "KanbanTeam_set_updated_at" before update on public."KanbanTeam"
for each row execute function public.set_updated_at();
create trigger "KanbanState_set_updated_at" before update on public."KanbanState"
for each row execute function public.set_updated_at();
create trigger "KanbanTag_set_updated_at" before update on public."KanbanTag"
for each row execute function public.set_updated_at();
create trigger "KanbanCard_set_updated_at" before update on public."KanbanCard"
for each row execute function public.set_updated_at();
create trigger "KanbanCardTag_set_updated_at" before update on public."KanbanCardTag"
for each row execute function public.set_updated_at();

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
declare created public."Kanban";
begin
  if coalesce(array_length(p_team_ids, 1), 0) = 0 then
    raise exception 'El kanban debe estar asignado al menos a un equipo';
  end if;

  insert into public."Kanban" (name, "createdByUserId")
  values (p_name, p_actor_id)
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
end;
$$;

create or replace function public.cancel_team(p_team_id uuid)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  update public."Team" set status = 'CANCELLED' where id = p_team_id and status = 'ACTIVE';
  if not found then raise exception 'Equipo no encontrado'; end if;
  update public."TeamMembership" set status = 'CANCELLED' where "teamId" = p_team_id and status = 'ACTIVE';
  update public."KanbanTeam" set status = 'CANCELLED' where "teamId" = p_team_id and status = 'ACTIVE';
end;
$$;

create or replace function public.cancel_kanban(p_kanban_id uuid)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if exists (select 1 from public."KanbanCard" where "kanbanId" = p_kanban_id and status = 'ACTIVE') then
    raise exception 'No puedes eliminar un kanban que contiene tarjetas';
  end if;
  update public."Kanban" set status = 'CANCELLED' where id = p_kanban_id and status = 'ACTIVE';
  if not found then raise exception 'Kanban no encontrado'; end if;
  update public."KanbanTeam" set status = 'CANCELLED' where "kanbanId" = p_kanban_id and status = 'ACTIVE';
  update public."KanbanState" set status = 'CANCELLED' where "kanbanId" = p_kanban_id and status = 'ACTIVE';
  update public."KanbanTag" set status = 'CANCELLED' where "kanbanId" = p_kanban_id and status = 'ACTIVE';
end;
$$;

create or replace function public.cancel_kanban_state(p_state_id uuid)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if exists (select 1 from public."KanbanCard" where "stateId" = p_state_id and status = 'ACTIVE') then
    raise exception 'No puedes eliminar un estado que contiene tarjetas';
  end if;
  update public."KanbanState" set status = 'CANCELLED' where id = p_state_id and status = 'ACTIVE';
  if not found then raise exception 'Estado no encontrado'; end if;
end;
$$;

create or replace function public.cancel_kanban_tag(p_tag_id uuid)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  update public."KanbanTag" set status = 'CANCELLED' where id = p_tag_id and status = 'ACTIVE';
  if not found then raise exception 'Etiqueta no encontrada'; end if;
  update public."KanbanCardTag" set status = 'CANCELLED' where "tagId" = p_tag_id and status = 'ACTIVE';
end;
$$;

create or replace function public.cancel_kanban_card(p_card_id uuid)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  update public."KanbanCard" set status = 'CANCELLED' where id = p_card_id and status = 'ACTIVE';
  if not found then raise exception 'Tarjeta no encontrada'; end if;
  update public."KanbanCardTag" set status = 'CANCELLED' where "cardId" = p_card_id and status = 'ACTIVE';
end;
$$;

alter table public."AppUser" enable row level security;
alter table public."Team" enable row level security;
alter table public."TeamMembership" enable row level security;
alter table public."Kanban" enable row level security;
alter table public."KanbanTeam" enable row level security;
alter table public."KanbanState" enable row level security;
alter table public."KanbanTag" enable row level security;
alter table public."KanbanCard" enable row level security;
alter table public."KanbanCardTag" enable row level security;

revoke all on table public."AppUser", public."Team", public."TeamMembership", public."Kanban", public."KanbanTeam", public."KanbanState", public."KanbanTag", public."KanbanCard", public."KanbanCardTag" from anon, authenticated;
grant select, insert, update, delete on table public."AppUser", public."Team", public."TeamMembership", public."Kanban", public."KanbanTeam", public."KanbanState", public."KanbanTag", public."KanbanCard", public."KanbanCardTag" to service_role;

revoke all on function public.create_kanban(text, uuid[], uuid) from public, anon, authenticated;
revoke all on function public.cancel_team(uuid) from public, anon, authenticated;
revoke all on function public.cancel_kanban(uuid) from public, anon, authenticated;
revoke all on function public.cancel_kanban_state(uuid) from public, anon, authenticated;
revoke all on function public.cancel_kanban_tag(uuid) from public, anon, authenticated;
revoke all on function public.cancel_kanban_card(uuid) from public, anon, authenticated;
grant execute on function public.create_kanban(text, uuid[], uuid) to service_role;
grant execute on function public.cancel_team(uuid) to service_role;
grant execute on function public.cancel_kanban(uuid) to service_role;
grant execute on function public.cancel_kanban_state(uuid) to service_role;
grant execute on function public.cancel_kanban_tag(uuid) to service_role;
grant execute on function public.cancel_kanban_card(uuid) to service_role;
