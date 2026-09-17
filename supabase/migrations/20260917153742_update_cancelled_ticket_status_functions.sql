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
  actor text := left(replace(p_actor_name, '@', '@' || chr(8203)), 4000);
  code text;
  content text;
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
    if previous.status is distinct from changed.status then
      code := format('RTP-%s', changed.id);
      content := case changed.status
        when 'EN_PROGRESO' then format('🔄 **¡Tenemos movimiento en el Kanban!** 🛹✨%s**%s** actualizó el ticket `%s` y ahora está **EN PROGRESO** 🚧%sLa quest ha comenzado, besties. Alguien ya se puso la 10 y está cocinando una solución, uwu 🍳🔥', E'\n', actor, code, E'\n')
        when 'PENDIENTE' then format('⏳ **Mini pausa administrativa** (｡•́︿•̀｡)%sEl ticket `%s` fue actualizado por **%s** y quedó **PENDIENTE** 🎀%sTodavía no entra al horno, pero ya está haciendo fila educadamente. Paciencia, bestie: su momento slay llegará 🧍✨', E'\n', code, actor, E'\n')
        when 'EN_STAGING' then format('🧪 **¡Entramos en la era de las pruebibas!** ✨%s**%s** movió el ticket `%s` a **EN STAGING** 🧑‍🔬🎀%sLa solución ya está en su ensayo general: probando el outfit antes de salir a producción 💃🏻%sManifestando cero bugs, uwu 🕯️ʕ•́ᴥ•̀ʔっ', E'\n', actor, code, E'\n', E'\n')
        when 'RESUELTO' then format('🎉 **¡Caso cerrado, criaturas!** 🎉%sEl ticket `%s` fue marcado como **RESUELTO** por **%s** ✅💖%sEl problema fue derrotado, la paz regresó al reino y el team sirvió desarrollo con éxito 💅🏻✨%sCommon support W, besties ʕっ•ᴥ•ʔっ♡', E'\n', code, actor, E'\n', E'\n')
        when 'CANCELADO' then format('🚫 **Ticket cancelado** ✨%s**%s** marcó el ticket `%s` como **CANCELADO** 🧾%sYa no hace falta desarrollarlo, así que cerramos esta vueltita y dejamos registro prolijo, bestie 🎀', E'\n', actor, code, E'\n')
        when 'EN_ESPERA' then format('🛑 **El ticket entró en modo “ahí te aviso”** 🧍🏻‍♀️💭%s**%s** cambió el estado de `%s` a **EN ESPERA** ⏸️🎀%sPor ahora toca hacer una pausita dramática y aguardar novedades…%sNo está olvidado, solo está teniendo su training arc, uwu 🌸✨', E'\n', actor, code, E'\n', E'\n')
      end;
    else
      content := format('✨ **¡El ticket recibió un glow-up!** ✨%s**%s** actualizó el ticket `%s` desde la web 🎀', E'\n', actor, format('RTP-%s', changed.id));
      if previous.title is distinct from changed.title then content := content || E'\n📝 El titulito quedó actualizado, bestie.'; end if;
      if previous.description is distinct from changed.description then content := content || E'\n💬 El chismecito recibió nuevos detalles.'; end if;
      if previous.type is distinct from changed.type then content := content || format(E'\n🧩 Tipo de dramita: **%s**.', case changed.type when 'REQUERIMIENTO' then '📋 Nueva petición' when 'MEJORA' then '✨ Mejora con glow-up' when 'DUDA' then '💭 Dudita existencial' when 'BUG' then '🐛 Bug travieso' end); end if;
      if previous.priority is distinct from changed.priority then content := content || format(E'\n🚦 Nivel de fueguito: **%s**.', case changed.priority when 'BAJA' then '🌱 Suavecito, puede esperar' when 'MEDIA' then '✨ Importante, pero respiramos' when 'ALTA' then '🔥 Ojo aquí, urge prontito' when 'CRITICA' then '🚨 Todo arde, ayuda ya' end); end if;
      if previous.platform is distinct from changed.platform then content := content || format(E'\n🖥️ Plataforma: **%s**.', coalesce(case changed.platform when 'NESTOR' then '🌸 Nestor' when 'DYLAN' then '⭐ Dylan' when 'ATOM' then '⚛️ Atom' when 'KAYS' then '🎀 Kays' when 'EXTERNO' then '🌍 Externo' end, 'Sin asignar')); end if;
    end if;

    insert into public."TicketSyncOutbox" ("ticketPublicId", type, payload)
    values (p_public_id, 'SEND_THREAD_MESSAGE', jsonb_build_object('threadId', changed."discordThreadId", 'content', content));

    if previous.platform is distinct from changed.platform and changed.platform is not null then
      insert into public."TicketSyncOutbox" ("ticketPublicId", type, payload)
      values (p_public_id, 'SEND_THREAD_MESSAGE', jsonb_build_object('threadId', changed."discordThreadId", 'syncControls', true, 'assignedBy', actor));
    end if;
  end if;

  return changed;
end;
$$;

create or replace function public.get_ticket_metrics(
  p_days integer default 30,
  p_platform public."Platform" default null,
  p_stale_days integer default 3,
  p_unassigned_hours integer default 4
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
with params as (
  select
    greatest(1, least(p_days, 90)) as days,
    greatest(1, least(p_stale_days, 30)) as stale_days,
    greatest(1, least(p_unassigned_hours, 168)) as unassigned_hours,
    now() - make_interval(days => greatest(1, least(p_days, 90))) as from_at
),
filtered_tickets as (
  select t.*
  from public."Ticket" t, params p
  where t."createdAt" >= p.from_at
    and (p_platform is null or t.platform = p_platform)
),
status_changes as (
  select
    a."ticketPublicId",
    a."createdAt",
    a.changes->'before'->>'status' as before_status,
    a.changes->'after'->>'status' as after_status
  from public."TicketActivity" a
  join filtered_tickets t on t."publicId" = a."ticketPublicId"
  where a.action = 'UPDATED'
),
first_ack as (
  select distinct on (s."ticketPublicId")
    s."ticketPublicId",
    extract(epoch from (s."createdAt" - t."createdAt")) / 60 as minutes
  from status_changes s
  join filtered_tickets t on t."publicId" = s."ticketPublicId"
  where s.before_status = 'PENDIENTE'
    and s.after_status is distinct from 'PENDIENTE'
  order by s."ticketPublicId", s."createdAt"
),
resolved as (
  select distinct on (s."ticketPublicId")
    s."ticketPublicId",
    s."createdAt" as resolved_at,
    extract(epoch from (s."createdAt" - t."createdAt")) / 60 as minutes
  from status_changes s
  join filtered_tickets t on t."publicId" = s."ticketPublicId"
  where s.after_status = 'RESUELTO'
  order by s."ticketPublicId", s."createdAt"
),
weekly as (
  select
    to_char(date_trunc('week', d)::date, 'YYYY-MM-DD') as week,
    count(*) filter (where kind = 'created') as created,
    count(*) filter (where kind = 'resolved') as resolved
  from (
    select date_trunc('week', t."createdAt") as d, 'created' as kind
    from filtered_tickets t
    union all
    select date_trunc('week', r.resolved_at) as d, 'resolved' as kind
    from resolved r
  ) events
  group by date_trunc('week', d)
  order by date_trunc('week', d)
),
similar_groups as (
  select
    t.type,
    t.platform,
    lower(trim(regexp_replace(t.title, '[^[:alnum:]]+', ' ', 'g'))) as signature,
    count(*) as count,
    array_agg(jsonb_build_object('id', t."publicId", 'title', t.title) order by t."createdAt" desc) as tickets
  from filtered_tickets t
  group by t.type, t.platform, lower(trim(regexp_replace(t.title, '[^[:alnum:]]+', ' ', 'g')))
  having count(*) > 1
  order by count(*) desc
  limit 20
)
select jsonb_build_object(
  'rangeDays', (select days from params),
  'summary', jsonb_build_object(
    'openHighToday', (select count(*) from public."Ticket" t where t.status not in ('RESUELTO', 'CANCELADO') and t.priority in ('ALTA', 'CRITICA') and (p_platform is null or t.platform = p_platform)),
    'unassigned', (select count(*) from public."Ticket" t where t.platform is null and t.status not in ('RESUELTO', 'CANCELADO') and (p_platform is null or t.platform = p_platform)),
    'stagnant', (select count(*) from public."Ticket" t, params p where t.status not in ('RESUELTO', 'CANCELADO') and t."updatedAt" < now() - make_interval(days => p.stale_days) and (p_platform is null or t.platform = p_platform))
  ),
  'volume', jsonb_build_object(
    'createdByPlatform', coalesce((select jsonb_agg(jsonb_build_object('platform', platform, 'count', count) order by platform) from (select coalesce(platform::text, 'UNASSIGNED') platform, count(*) from filtered_tickets group by platform) x), '[]'::jsonb),
    'urgencyByPlatform', coalesce((select jsonb_agg(jsonb_build_object('platform', coalesce(platform::text, 'UNASSIGNED'), 'priority', priority, 'count', count) order by platform, priority) from (select platform, priority, count(*) from filtered_tickets group by platform, priority) x), '[]'::jsonb),
    'typeDistribution', coalesce((select jsonb_agg(jsonb_build_object('type', type, 'count', count) order by type) from (select type, count(*) from filtered_tickets group by type) x), '[]'::jsonb),
    'weeklyTrend', coalesce((select jsonb_agg(to_jsonb(weekly) order by week) from weekly), '[]'::jsonb)
  ),
  'response', jsonb_build_object(
    'ttaMinutes', coalesce((select round(avg(minutes)::numeric, 1) from first_ack), 0),
    'ttrByPriority', coalesce((select jsonb_agg(jsonb_build_object('priority', priority, 'count', count, 'mttrMinutes', round(mttr::numeric, 1)) order by priority) from (select t.priority, count(*) count, avg(r.minutes) mttr from resolved r join filtered_tickets t on t."publicId" = r."ticketPublicId" group by t.priority) x), '[]'::jsonb),
    'ttrByPlatform', coalesce((select jsonb_agg(jsonb_build_object('platform', coalesce(platform::text, 'UNASSIGNED'), 'count', count, 'mttrMinutes', round(mttr::numeric, 1)) order by mttr desc) from (select t.platform, count(*) count, avg(r.minutes) mttr from resolved r join filtered_tickets t on t."publicId" = r."ticketPublicId" group by t.platform) x), '[]'::jsonb),
    'sla', coalesce((select jsonb_agg(jsonb_build_object('priority', priority, 'eligible', eligible, 'withinSla', within_sla, 'percentage', round(within_sla * 100.0 / nullif(eligible, 0), 1)) order by priority) from (select t.priority, count(*) eligible, count(*) filter (where r.minutes <= case t.priority when 'ALTA' then 1440 when 'CRITICA' then 1440 when 'MEDIA' then 4320 else null end) within_sla from resolved r join filtered_tickets t on t."publicId" = r."ticketPublicId" group by t.priority) x), '[]'::jsonb),
    'reopened', (select count(*) from status_changes where before_status in ('EN_STAGING', 'RESUELTO') and after_status = 'EN_PROGRESO')
  ),
  'quality', jsonb_build_object(
    'mttrByPlatform', coalesce((select jsonb_agg(jsonb_build_object('platform', coalesce(platform::text, 'UNASSIGNED'), 'count', count, 'mttrMinutes', round(mttr::numeric, 1)) order by mttr desc) from (select t.platform, count(*) count, avg(r.minutes) mttr from resolved r join filtered_tickets t on t."publicId" = r."ticketPublicId" group by t.platform) x), '[]'::jsonb),
    'unassignedAfterHours', (select count(*) from filtered_tickets t, params p where t.platform is null and t.status not in ('RESUELTO', 'CANCELADO') and t."createdAt" < now() - make_interval(hours => p.unassigned_hours)),
    'stagnantTickets', coalesce((select jsonb_agg(jsonb_build_object('id', t."publicId", 'title', t.title, 'status', t.status, 'updatedAt', t."updatedAt") order by t."updatedAt") from (select t.* from filtered_tickets t, params p where t.status not in ('RESUELTO', 'CANCELADO') and t."updatedAt" < now() - make_interval(days => p.stale_days) order by t."updatedAt" limit 50) t), '[]'::jsonb),
    'similarGroups', coalesce((select jsonb_agg(jsonb_build_object('type', type, 'platform', coalesce(platform::text, 'UNASSIGNED'), 'count', count, 'signature', signature, 'tickets', tickets)) from similar_groups), '[]'::jsonb)
  )
);
$$;

revoke all on function public.get_ticket_metrics(integer, public."Platform", integer, integer) from public, anon, authenticated;
grant execute on function public.get_ticket_metrics(integer, public."Platform", integer, integer) to service_role;
