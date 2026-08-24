import type { Ticket } from '@/lib/types';

export function ticketCode(ticket: Pick<Ticket, 'id'>) {
  return `RTP-${ticket.id}`;
}

export function ticketThreadName(ticket: Pick<Ticket, 'id' | 'title'>) {
  const title = ticket.title.replace(/[\r\n\t]+/g, ' ').trim();
  return `${ticketCode(ticket)}: ${title}`.slice(0, 100);
}
