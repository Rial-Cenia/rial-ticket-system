'use client';

import { useDroppable } from '@dnd-kit/core';
import { TicketCard } from '@/components/kanban/ticket-card';
import { STATUS_LABELS, type Ticket, type TicketStatus } from '@/lib/types';

const dots: Record<TicketStatus, string> = {
  PENDIENTE: 'bg-red-400',
  EN_PROGRESO: 'bg-yellow-400',
  EN_ESPERA: 'bg-orange-400',
  RESUELTO: 'bg-emerald-400',
};

export function KanbanColumn({
  status,
  tickets,
  onOpen,
}: {
  status: TicketStatus;
  tickets: Ticket[];
  onOpen: (ticket: Ticket) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <section
      ref={setNodeRef}
      className={`w-[320px] shrink-0 rounded-2xl border p-3 transition ${isOver ? 'border-blue-400/50 bg-blue-500/8' : 'border-white/8 bg-zinc-950/45'}`}
    >
      <header className="mb-3 flex items-center justify-between px-1">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <span className={`size-2 rounded-full ${dots[status]}`} />
          {STATUS_LABELS[status]}
        </h2>
        <span className="rounded-full bg-white/7 px-2 py-0.5 text-xs text-zinc-500">
          {tickets.length}
        </span>
      </header>
      <div className="space-y-3">
        {tickets.map((ticket) => (
          <TicketCard key={ticket.publicId} ticket={ticket} onOpen={onOpen} />
        ))}
        {tickets.length === 0 && (
          <div className="grid min-h-28 place-items-center rounded-xl border border-dashed border-white/8 text-sm text-zinc-700">
            Sin tickets
          </div>
        )}
      </div>
    </section>
  );
}
