'use client';

import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { KanbanColumn } from '@/components/kanban/kanban-column';
import { useUpdateTicket } from '@/hooks/use-tickets';
import { TICKET_STATUSES, type Ticket, type TicketStatus } from '@/lib/types';

export function KanbanBoard({
  tickets,
  onOpen,
}: {
  tickets: Ticket[];
  onOpen: (ticket: Ticket) => void;
}) {
  const update = useUpdateTicket();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );
  function dropped(event: DragEndEvent) {
    const ticket = event.active.data.current?.ticket as Ticket | undefined;
    const status = event.over?.id as TicketStatus | undefined;
    if (
      ticket &&
      status &&
      TICKET_STATUSES.includes(status) &&
      ticket.status !== status
    )
      update.mutate({ publicId: ticket.publicId, patch: { status } });
  }
  return (
    <DndContext sensors={sensors} onDragEnd={dropped}>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {TICKET_STATUSES.map((status) => (
          <KanbanColumn
            key={status}
            status={status}
            tickets={tickets.filter((ticket) => ticket.status === status)}
            onOpen={onOpen}
          />
        ))}
      </div>
    </DndContext>
  );
}
