'use client';

import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { useMemo, useState } from 'react';
import { KanbanColumn } from '@/components/kanban/kanban-column';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  const [sortBy, setSortBy] = useState<'updated' | 'priority'>('updated');
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
  const ticketsByStatus = useMemo(() => {
    const priorityOrder = { CRITICA: 0, ALTA: 1, MEDIA: 2, BAJA: 3 };
    const sorted = [...tickets].sort((first, second) =>
      sortBy === 'priority'
        ? priorityOrder[first.priority] - priorityOrder[second.priority]
        : new Date(second.updatedAt).getTime() -
          new Date(first.updatedAt).getTime(),
    );
    return new Map(
      TICKET_STATUSES.map((status) => [
        status,
        sorted.filter((ticket) => ticket.status === status),
      ]),
    );
  }, [sortBy, tickets]);

  return (
    <DndContext sensors={sensors} onDragEnd={dropped}>
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-sm text-zinc-500">
            Ordenar
            <Select
              value={sortBy}
              onValueChange={(value) => setSortBy(value as typeof sortBy)}
            >
              <SelectTrigger
                aria-label="Ordenar tablero"
                className="h-9 min-w-48"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="updated">Última actualización</SelectItem>
                <SelectItem value="priority">
                  Prioridad: crítica a baja
                </SelectItem>
              </SelectContent>
            </Select>
          </label>
        </div>
        <div className="-mx-4 overflow-x-auto overscroll-x-contain px-4 pb-4 sm:mx-0 sm:px-0">
          <div className="flex w-max snap-x snap-mandatory gap-4">
            {TICKET_STATUSES.map((status) => (
              <KanbanColumn
                key={status}
                status={status}
                tickets={ticketsByStatus.get(status) ?? []}
                onOpen={onOpen}
              />
            ))}
          </div>
        </div>
      </div>
    </DndContext>
  );
}
