alter table public."KanbanCardComment"
add column "anchorText" text check (
  "anchorText" is null
  or char_length("anchorText") between 1 and 1000
);

create index "KanbanCardComment_card_anchor_createdAt_idx"
on public."KanbanCardComment" ("kanbanCardId", "createdAt")
where "anchorText" is not null;
