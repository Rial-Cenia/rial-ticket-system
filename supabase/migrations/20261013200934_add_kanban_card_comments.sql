create table public."KanbanCardComment" (
  id uuid primary key default gen_random_uuid(),
  "kanbanCardId" uuid not null references public."KanbanCard"(id) on delete cascade,
  content text not null check (char_length(content) <= 4000),
  "createdByUserId" uuid not null references auth.users(id),
  "createdAt" timestamptz not null default now()
);

create index "KanbanCardComment_card_createdAt_idx"
on public."KanbanCardComment" ("kanbanCardId", "createdAt");

create table public."KanbanCardCommentAttachment" (
  id uuid primary key,
  "commentId" uuid not null references public."KanbanCardComment"(id) on delete cascade,
  "storagePath" text not null unique check (char_length("storagePath") between 1 and 500),
  "fileName" text not null check (char_length("fileName") between 1 and 255),
  "mimeType" text not null check (
    "mimeType" in (
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
      'application/pdf',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/markdown',
      'application/vnd.iccprofile',
      'text/x-python'
    )
  ),
  size integer not null check (size between 1 and 10485760),
  "createdAt" timestamptz not null default now()
);

create index "KanbanCardCommentAttachment_comment_idx"
on public."KanbanCardCommentAttachment" ("commentId", "createdAt");

alter table public."KanbanCardComment" enable row level security;
alter table public."KanbanCardCommentAttachment" enable row level security;

revoke all on table public."KanbanCardComment", public."KanbanCardCommentAttachment" from anon, authenticated;
grant select, insert, update, delete on table public."KanbanCardComment", public."KanbanCardCommentAttachment" to service_role;
