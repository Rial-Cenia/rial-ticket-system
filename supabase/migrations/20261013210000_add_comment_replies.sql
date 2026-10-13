alter table public."KanbanCardComment"
add column "parentCommentId" uuid references public."KanbanCardComment"(id) on delete cascade;

create index "KanbanCardComment_parent_idx"
on public."KanbanCardComment" ("parentCommentId", "createdAt");

alter table public."KanbanCardComment"
add constraint "KanbanCardComment_not_self_parent"
check ("parentCommentId" is null or "parentCommentId" <> id);
