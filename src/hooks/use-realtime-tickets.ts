'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ticketKeys } from '@/hooks/use-tickets';

export function useRealtimeTickets() {
  const queryClient = useQueryClient();
  useEffect(() => {
    const supabase = createClient();
    const emit = (status: string) =>
      window.dispatchEvent(
        new CustomEvent('ticket-sync-status', { detail: status }),
      );
    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'Ticket' },
        () => {
          void queryClient.invalidateQueries({ queryKey: ticketKeys.all });
        },
      )
      .subscribe(
        (status: 'SUBSCRIBED' | 'TIMED_OUT' | 'CLOSED' | 'CHANNEL_ERROR') => {
          const label =
            status === 'SUBSCRIBED'
              ? 'Conectado'
              : status === 'CLOSED'
                ? 'Desconectado'
                : status === 'CHANNEL_ERROR'
                  ? 'Error'
                  : 'Conectando';
          emit(label);
          if (status === 'SUBSCRIBED')
            void queryClient.invalidateQueries({ queryKey: ticketKeys.all });
        },
      );
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);
}
