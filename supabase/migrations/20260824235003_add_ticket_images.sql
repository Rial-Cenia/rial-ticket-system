create table public."TicketImage" (
  id uuid primary key,
  "ticketPublicId" uuid not null references public."Ticket" ("publicId") on delete cascade,
  "storagePath" text not null unique check (char_length("storagePath") between 1 and 500),
  "fileName" text not null check (char_length("fileName") between 1 and 255),
  "mimeType" text not null check ("mimeType" in ('image/jpeg', 'image/png', 'image/webp', 'image/gif')),
  size integer not null check (size between 1 and 10485760),
  "createdAt" timestamptz not null default now()
);

create index "TicketImage_ticketPublicId_idx"
on public."TicketImage" ("ticketPublicId", "createdAt");

alter table public."TicketImage" enable row level security;
revoke all on table public."TicketImage" from anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'ticket-images',
  'ticket-images',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.create_ticket_with_images(
  p_public_id uuid,
  p_title text,
  p_description text,
  p_type public."TicketType",
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
    platform,
    "createdByName",
    "createdByDiscordId"
  )
  values (
    p_public_id,
    p_title,
    p_description,
    p_type,
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

revoke all on function public.create_ticket_with_images(
  uuid,
  text,
  text,
  public."TicketType",
  public."Platform",
  public."ActivitySource",
  text,
  text,
  text,
  jsonb
) from public, anon, authenticated;

grant execute on function public.create_ticket_with_images(
  uuid,
  text,
  text,
  public."TicketType",
  public."Platform",
  public."ActivitySource",
  text,
  text,
  text,
  jsonb
) to service_role;
