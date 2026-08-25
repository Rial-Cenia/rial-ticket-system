'use client';

import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { GripVertical, MessageSquareText } from 'lucide-react';
import {
  PlatformBadge,
  PriorityBadge,
  TypeBadge,
} from '@/components/tickets/ticket-badges';
import type { Ticket } from '@/lib/types';
import { ticketCode } from '@/lib/tickets/format';

export function TicketCard({
  ticket,
  onOpen,
}: {
  ticket: Ticket;
  onOpen: (ticket: Ticket) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: ticket.publicId, data: { ticket } });
  return (
    <article
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={`group relative rounded-xl border border-white/8 bg-zinc-900 p-4 shadow-lg transition hover:border-white/15 ${isDragging ? 'z-50 opacity-60' : ''}`}
    >
      <button
        className="absolute inset-0 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
        aria-label={`Abrir detalle de ${ticket.title}`}
        onClick={() => onOpen(ticket)}
      />
      <div className="pointer-events-none relative mb-3 flex items-start justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          <TypeBadge type={ticket.type} />
          <PriorityBadge priority={ticket.priority} />
          <PlatformBadge platform={ticket.platform} />
        </div>
        <button
          className="pointer-events-auto relative z-10 cursor-grab rounded-md p-1 text-zinc-600 hover:bg-white/8 hover:text-zinc-300"
          aria-label={`Arrastrar ${ticket.title}`}
          {...listeners}
          {...attributes}
        >
          <GripVertical className="size-4" />
        </button>
      </div>
      <div className="pointer-events-none relative text-left">
        <span className="mb-1 block font-mono text-xs text-indigo-400">
          {ticketCode(ticket)}
        </span>
        <h3 className="font-medium text-zinc-100">{ticket.title}</h3>
        <p className="mt-1 line-clamp-2 text-sm leading-5 text-zinc-500">
          {ticket.description}
        </p>
        <div className="mt-4 flex items-center justify-between text-xs text-zinc-600">
          <span>{ticket.createdByName}</span>
          <span>
            {formatDistanceToNow(new Date(ticket.createdAt), {
              addSuffix: true,
              locale: es,
            })}
          </span>
        </div>
        {ticket.discordThreadId && (
          <span className="mt-2 flex items-center gap-1 text-[11px] text-indigo-400">
            <MessageSquareText className="size-3" />
            Sincronizado con Discord
          </span>
        )}
      </div>
    </article>
  );
}
