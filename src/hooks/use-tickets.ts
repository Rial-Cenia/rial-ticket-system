'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from '@/lib/api/tickets';
import type { CreateTicketInput, UpdateTicketInput } from '@/lib/schemas';
import type { Ticket, TicketFilters } from '@/lib/types';

export const ticketKeys = {
  all: ['tickets'] as const,
  list: (filters: TicketFilters) => ['tickets', filters] as const,
  discordConversation: (publicId: string) =>
    ['tickets', publicId, 'discord-conversation'] as const,
};

export function useTickets(filters: TicketFilters) {
  return useQuery({
    queryKey: ticketKeys.list(filters),
    queryFn: () => api.fetchTickets(filters),
  });
}

export function useCreateTicket() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTicketInput) => api.createTicket(input),
    onSuccess: () => client.invalidateQueries({ queryKey: ticketKeys.all }),
  });
}

export function useUpdateTicket() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      publicId,
      patch,
    }: {
      publicId: string;
      patch: UpdateTicketInput;
    }) => api.updateTicket(publicId, patch),
    onMutate: async ({ publicId, patch }) => {
      await client.cancelQueries({ queryKey: ticketKeys.all });
      const snapshots = client.getQueriesData<Ticket[]>({
        queryKey: ticketKeys.all,
      });
      client.setQueriesData<Ticket[]>({ queryKey: ticketKeys.all }, (tickets) =>
        tickets?.map((ticket) =>
          ticket.publicId === publicId
            ? { ...ticket, ...patch, updatedAt: new Date().toISOString() }
            : ticket,
        ),
      );
      return { snapshots };
    },
    onError: (_, __, context) =>
      context?.snapshots.forEach(([key, data]) =>
        client.setQueryData(key, data),
      ),
    onSettled: () => client.invalidateQueries({ queryKey: ticketKeys.all }),
  });
}

export function useDeleteTicket() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: api.deleteTicket,
    onSuccess: () => client.invalidateQueries({ queryKey: ticketKeys.all }),
  });
}

export function useDiscordConversation(ticket: Ticket | null) {
  return useQuery({
    queryKey: ticketKeys.discordConversation(ticket?.publicId ?? ''),
    queryFn: () => api.fetchDiscordConversation(ticket!.publicId),
    enabled: Boolean(ticket?.discordThreadId),
    staleTime: 30_000,
  });
}
