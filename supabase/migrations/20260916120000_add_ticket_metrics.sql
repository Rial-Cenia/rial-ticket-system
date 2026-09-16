create index "Ticket_createdAt_platform_idx"
on public."Ticket" ("createdAt" desc, platform);

create index "TicketActivity_createdAt_idx"
on public."TicketActivity" ("createdAt" desc);

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
similar as (
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
    'openHighToday', (select count(*) from public."Ticket" t where t.status <> 'RESUELTO' and t.priority in ('ALTA', 'CRITICA') and (p_platform is null or t.platform = p_platform)),
    'unassigned', (select count(*) from public."Ticket" t where t.platform is null and t.status <> 'RESUELTO' and (p_platform is null or t.platform = p_platform)),
    'stagnant', (select count(*) from public."Ticket" t, params p where t.status <> 'RESUELTO' and t."updatedAt" < now() - make_interval(days => p.stale_days) and (p_platform is null or t.platform = p_platform))
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
    'unassignedAfterHours', (select count(*) from filtered_tickets t, params p where t.platform is null and t.status <> 'RESUELTO' and t."createdAt" < now() - make_interval(hours => p.unassigned_hours)),
    'stagnantTickets', coalesce((select jsonb_agg(jsonb_build_object('id', t."publicId", 'title', t.title, 'status', t.status, 'updatedAt', t."updatedAt") order by t."updatedAt") from (select t.* from filtered_tickets t, params p where t.status <> 'RESUELTO' and t."updatedAt" < now() - make_interval(days => p.stale_days) order by t."updatedAt" limit 50) t), '[]'::jsonb),
    'similarGroups', coalesce((select jsonb_agg(jsonb_build_object('type', type, 'platform', coalesce(platform::text, 'UNASSIGNED'), 'count', count, 'signature', signature, 'tickets', tickets)) from similar), '[]'::jsonb)
  )
);
$$;

revoke all on function public.get_ticket_metrics(integer, public."Platform", integer, integer) from public, anon, authenticated;
grant execute on function public.get_ticket_metrics(integer, public."Platform", integer, integer) to service_role;
