create table public."TriagerRotation" (
  id boolean primary key default true check (id),
  enabled boolean not null default false,
  "startsOn" date not null,
  "updatedAt" timestamptz not null default now()
);

insert into public."TriagerRotation" (id, "startsOn")
values (true, date_trunc('week', current_date)::date);

create table public."TriagerRotationMember" (
  "userId" uuid primary key references public."DiscordAccountLink"("userId") on delete cascade,
  position integer not null unique check (position >= 0)
);

create table public."TriagerRotationNotification" (
  "weekStartsOn" date primary key,
  status text not null check (status in ('PROCESSING', 'SENT')),
  "createdAt" timestamptz not null default now(),
  "sentAt" timestamptz
);

alter table public."TriagerRotation" enable row level security;
alter table public."TriagerRotationMember" enable row level security;
alter table public."TriagerRotationNotification" enable row level security;

revoke all on table public."TriagerRotation", public."TriagerRotationMember", public."TriagerRotationNotification" from anon, authenticated;
grant select, insert, update, delete on table public."TriagerRotation", public."TriagerRotationMember" to service_role;
grant select, insert, update, delete on table public."TriagerRotationNotification" to service_role;

create or replace function public.save_triager_rotation(
  p_enabled boolean,
  p_starts_on date,
  p_member_user_ids uuid[]
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_enabled and coalesce(array_length(p_member_user_ids, 1), 0) = 0 then
    raise exception 'Agrega al menos una persona a la rotación';
  end if;
  if (select count(distinct selected.user_id)
      from unnest(p_member_user_ids) as selected(user_id))
      <> array_length(p_member_user_ids, 1) then
    raise exception 'La lista contiene personas repetidas';
  end if;
  if extract(isodow from p_starts_on) <> 1 then
    raise exception 'La fecha de inicio debe ser lunes';
  end if;
  if exists (
    select 1
    from unnest(p_member_user_ids) as selected(user_id)
    left join public."DiscordAccountLink" link on link."userId" = selected.user_id
    where link."userId" is null
  ) then
    raise exception 'Todas las personas deben vincular su cuenta de Discord';
  end if;

  update public."TriagerRotation"
  set enabled = p_enabled, "startsOn" = p_starts_on, "updatedAt" = now()
  where id = true;

  delete from public."TriagerRotationMember";
  insert into public."TriagerRotationMember" ("userId", position)
  select selected.user_id, (selected.ordinality - 1)::integer
  from unnest(p_member_user_ids) with ordinality as selected(user_id, ordinality);
end;
$$;

revoke all on function public.save_triager_rotation(boolean, date, uuid[]) from public, anon, authenticated;
grant execute on function public.save_triager_rotation(boolean, date, uuid[]) to service_role;
