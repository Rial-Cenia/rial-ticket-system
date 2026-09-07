'use client';

import {
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { UserRound } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useUpdateKanbanCard } from '@/hooks/use-kanbans';
import { PRIORITY_LABELS, type Kanban, type KanbanCard } from '@/lib/types';
import { cn } from '@/lib/utils';

export function TaskBoard({
  kanban,
  onOpen,
}: {
  kanban: Kanban;
  onOpen: (card: KanbanCard) => void;
}) {
  const update = useUpdateKanbanCard(kanban.id);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const card = kanban.cards.find(
      (candidate) => candidate.id === event.active.id,
    );
    const stateId = typeof event.over?.id === 'string' ? event.over.id : null;
    if (card && stateId && card.stateId !== stateId)
      update.mutate({ cardId: card.id, input: { stateId } });
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-3">
        {kanban.states.map((state) => (
          <TaskColumn
            key={state.id}
            stateId={state.id}
            name={state.name}
            cards={kanban.cards.filter((card) => card.stateId === state.id)}
            onOpen={onOpen}
          />
        ))}
      </div>
      {update.error && (
        <p className="mt-3 text-sm text-red-300">{update.error.message}</p>
      )}
    </DndContext>
  );
}

function TaskColumn({
  stateId,
  name,
  cards,
  onOpen,
}: {
  stateId: string;
  name: string;
  cards: KanbanCard[];
  onOpen: (card: KanbanCard) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stateId });
  return (
    <section
      ref={setNodeRef}
      className={cn(
        'w-80 shrink-0 rounded-2xl border border-white/8 bg-zinc-950/60 p-3',
        isOver && 'border-blue-400/50 bg-blue-500/5',
      )}
    >
      <header className="mb-3 flex items-center justify-between px-1">
        <h2 className="font-medium">{name}</h2>
        <Badge>{cards.length}</Badge>
      </header>
      <div className="min-h-24 space-y-3">
        {cards.map((card) => (
          <DraggableTaskCard key={card.id} card={card} onOpen={onOpen} />
        ))}
      </div>
    </section>
  );
}

function DraggableTaskCard({
  card,
  onOpen,
}: {
  card: KanbanCard;
  onOpen: (card: KanbanCard) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: card.id });
  return (
    <button
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={cn(
        'block w-full rounded-xl border border-white/8 bg-zinc-900 p-3 text-left shadow-sm transition hover:border-white/20',
        isDragging && 'z-50 opacity-60',
      )}
      onClick={() => onOpen(card)}
      {...listeners}
      {...attributes}
    >
      <div className="mb-2 flex flex-wrap gap-1">
        <Badge>{PRIORITY_LABELS[card.priority]}</Badge>
        {card.tags.map((tag) => (
          <Badge
            key={tag.id}
            className="border-blue-400/20 bg-blue-500/10 text-blue-300"
          >
            {tag.name}
          </Badge>
        ))}
      </div>
      <h3 className="font-medium text-zinc-100">{card.title}</h3>
      {card.description && (
        <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-xs text-zinc-500">
          {card.description}
        </p>
      )}
      {card.assignee && (
        <p
          className={cn(
            'mt-3 flex items-center gap-1.5 text-xs text-zinc-400',
            !card.assignee.isCurrentMember && 'text-amber-300',
          )}
        >
          <UserRound className="size-3.5" />
          {card.assignee.name}
          {!card.assignee.isCurrentMember && ' · No pertenece al equipo'}
        </p>
      )}
    </button>
  );
}
