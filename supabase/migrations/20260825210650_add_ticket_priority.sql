create type public."TicketPriority" as enum ('BAJA', 'MEDIA', 'ALTA', 'CRITICA');

alter table public."Ticket"
add column priority public."TicketPriority" not null default 'MEDIA';

create or replace function public.create_ticket(
  p_title text,
  p_description text,
  p_type public."TicketType",
  p_priority public."TicketPriority",
  p_platform public."Platform",
  p_source public."ActivitySource",
  p_actor_name text,
  p_actor_id text,
  p_discord_id text
)
returns public."Ticket"
language plpgsql
security invoker
set search_path = ''
as $$
declare
  created public."Ticket";
begin
  insert into public."Ticket" (
    title,
    description,
    type,
    priority,
    platform,
    "createdByName",
    "createdByDiscordId"
  )
  values (
    p_title,
    p_description,
    p_type,
    p_priority,
    p_platform,
    p_actor_name,
    p_discord_id
  )
  returning * into created;

  insert into public."TicketActivity" (
    "ticketPublicId",
    source,
    action,
    "actorName",
    "actorId",
    changes
  )
  values (
    created."publicId",
    p_source,
    'CREATED',
    p_actor_name,
    p_actor_id,
    to_jsonb(created)
  );

  insert into public."TicketSyncOutbox" ("ticketPublicId", type, payload)
  values (
    created."publicId",
    'CREATE_TRIAGE_THREAD',
    jsonb_build_object('ticketPublicId', created."publicId")
  );

  return created;
end;
$$;

create or replace function public.create_ticket_with_images(
  p_public_id uuid,
  p_title text,
  p_description text,
  p_type public."TicketType",
  p_priority public."TicketPriority",
  p_platform public."Platform",
  p_source public."ActivitySource",
  p_actor_name text,
  p_actor_id text,
  p_discord_id text,
  p_images jsonb
)
returns public."Ticket"
language plpgsql
security invoker
set search_path = ''
as $$
declare
  created public."Ticket";
begin
  if jsonb_typeof(p_images) <> 'array' or jsonb_array_length(p_images) > 5 then
    raise exception 'Invalid ticket images';
  end if;

  insert into public."Ticket" (
    "publicId",
    title,
    description,
    type,
    priority,
    platform,
    "createdByName",
    "createdByDiscordId"
  )
  values (
    p_public_id,
    p_title,
    p_description,
    p_type,
    p_priority,
    p_platform,
    p_actor_name,
    p_discord_id
  )
  returning * into created;

  insert into public."TicketImage" (
    id,
    "ticketPublicId",
    "storagePath",
    "fileName",
    "mimeType",
    size
  )
  select
    image.id,
    created."publicId",
    image."storagePath",
    image."fileName",
    image."mimeType",
    image.size
  from jsonb_to_recordset(p_images) as image(
    id uuid,
    "storagePath" text,
    "fileName" text,
    "mimeType" text,
    size integer
  );

  insert into public."TicketActivity" (
    "ticketPublicId",
    source,
    action,
    "actorName",
    "actorId",
    changes
  )
  values (
    created."publicId",
    p_source,
    'CREATED',
    p_actor_name,
    p_actor_id,
    jsonb_build_object('ticket', to_jsonb(created), 'images', p_images)
  );

  insert into public."TicketSyncOutbox" ("ticketPublicId", type, payload)
  values (
    created."publicId",
    'CREATE_TRIAGE_THREAD',
    jsonb_build_object('ticketPublicId', created."publicId")
  );

  return created;
end;
$$;

create or replace function public.update_ticket(
  p_public_id uuid,
  p_patch jsonb,
  p_source public."ActivitySource",
  p_actor_name text,
  p_actor_id text default null
)
returns public."Ticket"
language plpgsql
security invoker
set search_path = ''
as $$
declare
  previous public."Ticket";
  changed public."Ticket";
begin
  if p_patch = '{}'::jsonb or p_patch ?| array['publicId', 'id', 'createdByName', 'createdByDiscordId', 'discordThreadId', 'createdAt', 'updatedAt'] then
    raise exception 'Invalid ticket patch';
  end if;

  select * into previous from public."Ticket" where "publicId" = p_public_id for update;
  if not found then raise exception 'Ticket not found'; end if;

  update public."Ticket"
  set
    title = case when p_patch ? 'title' then p_patch->>'title' else title end,
    description = case when p_patch ? 'description' then p_patch->>'description' else description end,
    type = case when p_patch ? 'type' then (p_patch->>'type')::public."TicketType" else type end,
    priority = case when p_patch ? 'priority' then (p_patch->>'priority')::public."TicketPriority" else priority end,
    status = case when p_patch ? 'status' then (p_patch->>'status')::public."TicketStatus" else status end,
    platform = case when p_patch ? 'platform' then nullif(p_patch->>'platform', '')::public."Platform" else platform end
  where "publicId" = p_public_id
  returning * into changed;

  insert into public."TicketActivity" ("ticketPublicId", source, action, "actorName", "actorId", changes)
  values (
    p_public_id,
    p_source,
    'UPDATED',
    p_actor_name,
    p_actor_id,
    jsonb_build_object('before', to_jsonb(previous), 'after', to_jsonb(changed), 'patch', p_patch)
  );

  if p_source = 'WEB' and changed."discordThreadId" is not null then
    insert into public."TicketSyncOutbox" ("ticketPublicId", type, payload)
    values (
      p_public_id,
      'SEND_THREAD_MESSAGE',
      jsonb_build_object(
        'threadId', changed."discordThreadId",
        'content', format('%s El ticket fue actualizado por **%s**.%s%s%s',
          '🔄 Desde el tablero Kanban Web.',
          p_actor_name,
          case when p_patch ? 'status' then format(E'\nEstado: **%s**', changed.status) else '' end,
          case when p_patch ? 'priority' then format(
            E'\nPrioridad: **%s**',
            case changed.priority
              when 'BAJA' then '🌱 Bajita, puede esperar sin drama'
              when 'MEDIA' then '✨ Media, importante pero todavía respiramos'
              when 'ALTA' then '🔥 Alta, necesita atención prontito'
              when 'CRITICA' then '🚨 Crítica, todo está ardiendo'
            end
          ) else '' end,
          case when p_patch ? 'platform' then format(E'\nPlataforma: **%s**', coalesce(changed.platform::text, 'Sin asignar')) else '' end
        )
      )
    );
  end if;

  return changed;
end;
$$;

revoke all on function public.create_ticket(
  text,
  text,
  public."TicketType",
  public."TicketPriority",
  public."Platform",
  public."ActivitySource",
  text,
  text,
  text
) from public, anon, authenticated;

revoke all on function public.create_ticket_with_images(
  uuid,
  text,
  text,
  public."TicketType",
  public."TicketPriority",
  public."Platform",
  public."ActivitySource",
  text,
  text,
  text,
  jsonb
) from public, anon, authenticated;

grant execute on function public.create_ticket(
  text,
  text,
  public."TicketType",
  public."TicketPriority",
  public."Platform",
  public."ActivitySource",
  text,
  text,
  text
) to service_role;

grant execute on function public.create_ticket_with_images(
  uuid,
  text,
  text,
  public."TicketType",
  public."TicketPriority",
  public."Platform",
  public."ActivitySource",
  text,
  text,
  text,
  jsonb
) to service_role;
