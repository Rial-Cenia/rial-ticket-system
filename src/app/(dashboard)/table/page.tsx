'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { FilterBar } from '@/components/filters/filter-bar';
import { NewTicketModal } from '@/components/modals/new-ticket-modal';
import { TicketDetailModal } from '@/components/modals/ticket-detail-modal';
import { TicketTable } from '@/components/tickets/ticket-table';
import { Button } from '@/components/ui/button';
import { useRealtimeTickets } from '@/hooks/use-realtime-tickets';
import { useTickets } from '@/hooks/use-tickets';
import type { Ticket, TicketFilters } from '@/lib/types';

export default function TablePage() {
  const [filters, setFilters] = useState<TicketFilters>({});
  const [newOpen, setNewOpen] = useState(false);
  const [selected, setSelected] = useState<Ticket | null>(null);
  const tickets = useTickets(filters);
  useRealtimeTickets();

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Todos los tickets
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Vista operativa ordenable y filtrable.
          </p>
        </div>
        <Button onClick={() => setNewOpen(true)}>
          <Plus className="size-4" />
          Nuevo ticket
        </Button>
      </div>
      <FilterBar filters={filters} onChange={setFilters} />
      {tickets.isLoading && (
        <div className="h-72 animate-pulse rounded-xl border border-white/8 bg-white/4" />
      )}
      {tickets.error && (
        <div className="rounded-xl border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-300">
          {tickets.error.message}
        </div>
      )}
      {tickets.data && (
        <TicketTable tickets={tickets.data} onOpen={setSelected} />
      )}
      <NewTicketModal open={newOpen} onOpenChange={setNewOpen} />
      <TicketDetailModal
        ticket={selected}
        onOpenChange={(open) => !open && setSelected(null)}
      />
    </div>
  );
}
