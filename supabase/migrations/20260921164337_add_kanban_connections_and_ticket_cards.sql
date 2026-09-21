create table public."KanbanConnection" (
  id uuid primary key default gen_random_uuid(),
  "sourceKanbanId" uuid not null references public."Kanban"(id),
  "targetKanbanId" uuid not null references public."Kanban"(id),
  status public."RecordStatus" not null default 'ACTIVE',
  "createdByUserId" uuid not null references auth.users(id),
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  check ("sourceKanbanId" <> "targetKanbanId")
);

create unique index "KanbanConnection_active_route_key"
on public."KanbanConnection" ("sourceKanbanId", "targetKanbanId")
where status = 'ACTIVE';
create index "KanbanConnection_source_idx"
on public."KanbanConnection" ("sourceKanbanId", status);

create table public."TicketKanban" (
  id uuid primary key default gen_random_uuid(),
  "ticketPublicId" uuid not null references public."Ticket"("publicId") on delete cascade,
  "kanbanId" uuid not null references public."Kanban"(id),
  status public."RecordStatus" not null default 'ACTIVE',
  "createdByUserId" uuid not null references auth.users(id),
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create unique index "TicketKanban_active_key"
on public."TicketKanban" ("ticketPublicId", "kanbanId")
where status = 'ACTIVE';
create index "TicketKanban_ticket_idx"
on public."TicketKanban" ("ticketPublicId", status);

alter table public."KanbanCard"
add column "ticketPublicId" uuid references public."Ticket"("publicId") on delete set null;
create index "KanbanCard_ticket_idx"
on public."KanbanCard" ("ticketPublicId") where "ticketPublicId" is not null;

create trigger "KanbanConnection_set_updated_at"
before update on public."KanbanConnection"
for each row execute function public.set_updated_at();
create trigger "TicketKanban_set_updated_at"
before update on public."TicketKanban"
for each row execute function public.set_updated_at();

alter table public."KanbanConnection" enable row level security;
alter table public."TicketKanban" enable row level security;

revoke all on table public."KanbanConnection", public."TicketKanban" from anon, authenticated;
grant select, insert, update, delete on table public."KanbanConnection", public."TicketKanban" to service_role;
