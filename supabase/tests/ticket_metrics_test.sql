begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

insert into public."Ticket" ("publicId", title, description, type, priority, status, platform, "createdByName", "createdAt", "updatedAt")
values
  ('50000000-0000-0000-0000-000000000001', 'Error recurrente', 'Detalle A', 'BUG', 'ALTA', 'RESUELTO', 'EXTERNO', 'pgTAP', now() - interval '10 days', now() - interval '9 days 13 hours'),
  ('50000000-0000-0000-0000-000000000002', 'Error recurrente', 'Detalle B', 'BUG', 'MEDIA', 'RESUELTO', 'EXTERNO', 'pgTAP', now() - interval '8 days', now() - interval '4 days 16 hours'),
  ('50000000-0000-0000-0000-000000000003', 'Error recurrente', 'Detalle C', 'BUG', 'ALTA', 'RESUELTO', 'EXTERNO', 'pgTAP', now() - interval '5 days', now() - interval '3 days 8 hours'),
  ('50000000-0000-0000-0000-000000000004', 'Ticket estancado', 'Detalle D', 'BUG', 'ALTA', 'EN_PROGRESO', 'EXTERNO', 'pgTAP', now() - interval '10 days', now() - interval '10 days'),
  ('50000000-0000-0000-0000-000000000005', 'Ticket sin encargado', 'Detalle E', 'BUG', 'ALTA', 'EN_PROGRESO', null, 'pgTAP', now() - interval '10 days', now() - interval '10 days');

insert into public."TicketActivity" ("ticketPublicId", source, action, "actorName", "actorId", changes, "createdAt")
values
  ('50000000-0000-0000-0000-000000000001', 'WEB', 'CREATED', 'pgTAP', 'metrics-test', '{}'::jsonb, now() - interval '10 days'),
  ('50000000-0000-0000-0000-000000000001', 'WEB', 'UPDATED', 'pgTAP', 'metrics-test', '{"before":{"status":"PENDIENTE"},"after":{"status":"EN_PROGRESO"}}', now() - interval '9 days 23 hours'),
  ('50000000-0000-0000-0000-000000000001', 'WEB', 'UPDATED', 'pgTAP', 'metrics-test', '{"before":{"status":"EN_PROGRESO"},"after":{"status":"RESUELTO"}}', now() - interval '9 days 13 hours'),
  ('50000000-0000-0000-0000-000000000002', 'WEB', 'CREATED', 'pgTAP', 'metrics-test', '{}'::jsonb, now() - interval '8 days'),
  ('50000000-0000-0000-0000-000000000002', 'WEB', 'UPDATED', 'pgTAP', 'metrics-test', '{"before":{"status":"PENDIENTE"},"after":{"status":"EN_PROGRESO"}}', now() - interval '7 days 22 hours'),
  ('50000000-0000-0000-0000-000000000002', 'WEB', 'UPDATED', 'pgTAP', 'metrics-test', '{"before":{"status":"EN_PROGRESO"},"after":{"status":"RESUELTO"}}', now() - interval '4 days 16 hours'),
  ('50000000-0000-0000-0000-000000000003', 'WEB', 'CREATED', 'pgTAP', 'metrics-test', '{}'::jsonb, now() - interval '5 days'),
  ('50000000-0000-0000-0000-000000000003', 'WEB', 'UPDATED', 'pgTAP', 'metrics-test', '{"before":{"status":"PENDIENTE"},"after":{"status":"EN_PROGRESO"}}', now() - interval '4 days 21 hours'),
  ('50000000-0000-0000-0000-000000000003', 'WEB', 'UPDATED', 'pgTAP', 'metrics-test', '{"before":{"status":"EN_PROGRESO"},"after":{"status":"RESUELTO"}}', now() - interval '4 days 4 hours'),
  ('50000000-0000-0000-0000-000000000003', 'WEB', 'UPDATED', 'pgTAP', 'metrics-test', '{"before":{"status":"RESUELTO"},"after":{"status":"EN_PROGRESO"}}', now() - interval '4 days 3 hours'),
  ('50000000-0000-0000-0000-000000000003', 'WEB', 'UPDATED', 'pgTAP', 'metrics-test', '{"before":{"status":"EN_PROGRESO"},"after":{"status":"RESUELTO"}}', now() - interval '3 days 8 hours'),
  ('50000000-0000-0000-0000-000000000004', 'WEB', 'CREATED', 'pgTAP', 'metrics-test', '{}'::jsonb, now() - interval '10 days');

select is(
  (public.get_ticket_metrics(30, 'EXTERNO', 3, 4)->'volume'->'createdByPlatform'->0->>'count')::integer,
  4,
  'Metrics count tickets created for the selected platform'
);
select is(
  (public.get_ticket_metrics(30, 'EXTERNO', 3, 4)->'response'->>'ttaMinutes')::numeric,
  120,
  'Metrics calculate average time to acknowledge'
);
select is(
  (public.get_ticket_metrics(30, 'EXTERNO', 3, 4)->'response'->'ttrByPlatform'->0->>'mttrMinutes')::numeric,
  2220,
  'Metrics calculate MTTR from the first resolution'
);
select is(
  (select value->>'percentage' from jsonb_array_elements(public.get_ticket_metrics(30, 'EXTERNO', 3, 4)->'response'->'sla') value where value->>'priority' = 'ALTA'),
  '100.0',
  'High priority tickets meet the configured SLA'
);
select is(
  (select value->>'percentage' from jsonb_array_elements(public.get_ticket_metrics(30, 'EXTERNO', 3, 4)->'response'->'sla') value where value->>'priority' = 'MEDIA'),
  '0.0',
  'Medium priority tickets outside the configured SLA are counted'
);
select is(
  (public.get_ticket_metrics(30, 'EXTERNO', 3, 4)->'response'->>'reopened')::integer,
  1,
  'Metrics count transitions from resolved back to in progress'
);
select is(
  (public.get_ticket_metrics(30, 'EXTERNO', 3, 4)->'volume'->'typeDistribution'->0->>'count')::integer,
  4,
  'Metrics aggregate ticket types'
);
select is(
  (public.get_ticket_metrics(30, 'EXTERNO', 3, 4)->'volume'->'urgencyByPlatform'->0->>'count')::integer,
  2,
  'Metrics aggregate urgency by platform'
);
select is(
  (select count(*)::integer from jsonb_array_elements(public.get_ticket_metrics(30, 'EXTERNO', 3, 4)->'volume'->'weeklyTrend')),
  2,
  'Metrics return one trend point per week with activity'
);
select is(
  jsonb_array_length(public.get_ticket_metrics(30, 'EXTERNO', 3, 4)->'quality'->'similarGroups'),
  1,
  'Metrics group repeated titles by type and platform'
);
select is(
  jsonb_array_length(public.get_ticket_metrics(30, 'EXTERNO', 3, 4)->'quality'->'stagnantTickets'),
  1,
  'Metrics return stale tickets using the configured threshold'
);
select ok(
  (public.get_ticket_metrics(30, null, 3, 4)->'quality'->>'unassignedAfterHours')::integer >= 1,
  'Metrics count unassigned tickets beyond the configured threshold'
);
select is(
  (public.get_ticket_metrics(1, 'EXTERNO', 3, 4)->'volume'->'createdByPlatform'->0->>'count')::integer,
  0,
  'Metrics exclude tickets outside the selected date range'
);
select is(
  jsonb_array_length(public.get_ticket_metrics(30, 'ATOM', 3, 4)->'volume'->'createdByPlatform'),
  0,
  'Metrics exclude tickets from other platforms'
);
select ok(
  (public.get_ticket_metrics(30, 'EXTERNO', 1, 4)->'summary'->>'stagnant')::integer >= 1,
  'Metrics summary honors the stagnant-days configuration'
);
select is(
  (public.get_ticket_metrics(30, 'EXTERNO', 3, 4)->'quality'->'mttrByPlatform'->0->>'platform'),
  'EXTERNO',
  'Metrics quality comparison identifies the selected platform'
);

select * from finish();
rollback;
