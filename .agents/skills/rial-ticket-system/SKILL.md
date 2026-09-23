---
name: rial-ticket-system
description: Work on the rial-ticket-system Next.js/Supabase app, especially ticket metrics, Supabase migrations, project selection, tests, and production verification.
---

# Rial Ticket System

Use this skill for work inside `/Users/beatrizerrazuriz/Code/rial/rial-ticket-system` or when the user mentions Rial Ticket System, ticket metrics, ticket Kanban/table views, Discord ticket flows, or Supabase migrations for the ticket platform.

## Repository

- Repo root: `/Users/beatrizerrazuriz/Code/rial/rial-ticket-system`.
- Main branch exists and is used for the ticket system production changes in this workspace.
- The app is a Next.js app backed by Supabase. Keep UI changes consistent with existing components and do not add a UI library unless explicitly approved.
- Do not modify ticket creation, assignment, or Discord notification flows unless the user explicitly asks; metrics/reporting work should be read-only over existing ticket data.

## Supabase Project

The correct production Supabase project for this repo is:

- Name: `Rial Ticket Platform`
- Project/ref/id: `cotfbnslihddhgegtofm`
- URL: `https://cotfbnslihddhgegtofm.supabase.co`
- Organization id/slug seen in MCP: `wmiscvbogsghzzljoxyt`

The similarly named `Rial` project with ref `kjcxjuslqmxjtaclkbex` is not the ticket system. It contains the main Rial AI schema and must not receive ticket-system migrations.

When using the Supabase plugin/MCP, prefer tools that accept an explicit `project_id` and pass `cotfbnslihddhgegtofm`, for example:

- `mcp__codex_apps__supabase._list_projects`
- `mcp__codex_apps__supabase._list_migrations`
- `mcp__codex_apps__supabase._execute_sql`
- `mcp__codex_apps__supabase._apply_migration`
- `mcp__codex_apps__supabase._get_advisors`

The generic `mcp__supabase` tools can be scoped to the wrong active project. Always verify the project URL or tables before any remote write.

Expected ticket-system tables include `Ticket`, `TicketActivity`, `TicketImage`, `TicketSyncOutbox`, `Kanban`, `KanbanCard`, `KanbanTag`, `Team`, and related membership/state tables.

## Metrics Implementation Context

Ticket metrics were added as a read-only metrics view and backend aggregation endpoint. The important local files include:

- `src/app/(dashboard)/metrics/page.tsx`
- `src/app/api/metrics/tickets/route.ts`
- `src/components/metrics/ticket-metrics-view.tsx`
- `src/hooks/use-ticket-metrics.ts`
- `src/lib/api/metrics.ts`
- `src/lib/metrics/server.ts`
- `src/lib/metrics/constants.ts`
- `src/lib/metrics/types.ts`
- `supabase/tests/ticket_metrics_test.sql`

Production currently has these metrics migrations registered:

- `20260916171647` / `20260916120000_add_ticket_metrics`
- `20260916171801` / `20260916120100_add_ticket_activity_metrics_index`
- `20260916172049` / `20260916120200_ticket_metrics_fn`

Local migration files were split to match the production migration history:

- `supabase/migrations/20260916171647_20260916120000_add_ticket_metrics.sql`
- `supabase/migrations/20260916171801_20260916120100_add_ticket_activity_metrics_index.sql`
- `supabase/migrations/20260916172049_20260916120200_ticket_metrics_fn.sql`

The function `public.get_ticket_metrics(p_days, p_platform, p_stale_days, p_unassigned_hours)` returns JSON with `summary`, `volume`, `response`, and `quality`.

Security invariant: `get_ticket_metrics` should be `security invoker`, use `set search_path = ''`, and grant `EXECUTE` only to `service_role` besides owner/superuser. Do not leave it executable by `anon` or `authenticated`.

## Migration Lessons

- The repo's Supabase CLI flow may fail locally because `supabase/config.toml` has a `[local_smtp]` block that older/newer CLI versions reject.
- `supabase db push --linked --dry-run --yes` previously failed without `SUPABASE_DB_PASSWORD`.
- The plugin `_apply_migration` accepted small DDL but rejected the original long all-in-one SQL with `INVALID_ARGUMENT`.
- The function migration succeeded only after keeping permissions in the same migration and reducing the SQL payload size enough for the connector.
- If a long SQL body is rejected, do not create a function first and permissions later if that would leave a public access window. Keep creation and permission revokes/grants in the same operation, or stop and ask for a safer execution path.

## Tests And Verification

The package declares Yarn, but this environment may not have `yarn` on PATH. Use `npm test -- <files>` when needed; the script runs Vitest.

Useful targeted metrics test command:

```bash
npm test -- src/lib/metrics/server.test.ts src/app/api/metrics/tickets/route.test.ts src/components/metrics/ticket-metrics-view.test.tsx
```

Known result after metrics work: 3 files and 8 tests passing.

Full relevant checks previously run:

- `npm test` / Vitest: 30 files, 115 tests passing at the time of implementation.
- `npm test -- src/lib/metrics/server.test.ts src/app/api/metrics/tickets/route.test.ts src/components/metrics/ticket-metrics-view.test.tsx`: 3 files, 8 tests passing.
- Lint passed with one pre-existing warning in `src/components/tickets/ticket-table.tsx`.
- Build passed with required public Supabase/API env vars.
- `supabase test db` did not run locally because the local Supabase DB was not available.

For production metrics verification through MCP, useful checks are:

- list migrations for `cotfbnslihddhgegtofm`;
- confirm indexes `Ticket_createdAt_platform_idx` and `TicketActivity_createdAt_idx`;
- confirm routine `public.get_ticket_metrics`;
- execute `select public.get_ticket_metrics(7,null,3,4) ? 'summary' ...` to check the JSON shape;
- inspect `information_schema.routine_privileges` to ensure only `postgres`/`service_role` have `EXECUTE`.

## Existing Advisor Findings

After the metrics migration, Supabase advisors showed pre-existing items not caused by the metrics feature:

- RLS enabled with no policies on several tables.
- `pg_net` installed in `public`.
- `public.rls_auto_enable()` is `SECURITY DEFINER` and executable by `anon`/`authenticated`.
- Several unindexed foreign keys.
- New metrics indexes may show as unused immediately after creation; that is expected until query history accumulates.

Report these findings if relevant, but do not fix them opportunistically unless the user asks.
