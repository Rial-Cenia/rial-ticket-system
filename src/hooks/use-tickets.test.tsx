import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DiscordConversation, Ticket } from '@/lib/types';

const mocks = vi.hoisted(() => ({
  updateTicket: vi.fn(),
}));

vi.mock('@/lib/api/tickets', () => ({
  updateTicket: mocks.updateTicket,
}));

import { ticketKeys, useUpdateTicket } from '@/hooks/use-tickets';

const ticket: Ticket = {
  id: 11,
  publicId: 'ticket-11',
  title: 'Permisos GCP Benja',
  description: 'Darle los permisos a Benjita',
  type: 'REQUERIMIENTO',
  priority: 'MEDIA',
  status: 'PENDIENTE',
  platform: null,
  createdByName: 'Beatriz',
  createdByDiscordId: null,
  discordThreadId: 'thread-11',
  images: [],
  createdAt: '2026-08-25T10:00:00.000Z',
  updatedAt: '2026-08-25T10:30:00.000Z',
};

const conversation: DiscordConversation = {
  threadUrl: 'https://discord.com/channels/guild/thread-11',
  messages: [],
};

describe('useUpdateTicket', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('actualiza las listas sin tratar el chat de Discord como tickets', async () => {
    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    const listKey = ticketKeys.list({});
    const conversationKey = ticketKeys.discordConversation(ticket.publicId);
    client.setQueryData(listKey, [ticket]);
    client.setQueryData(conversationKey, conversation);
    mocks.updateTicket.mockResolvedValue({ ...ticket, platform: 'EXTERNO' });

    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useUpdateTicket(), { wrapper });

    await act(() =>
      result.current.mutateAsync({
        publicId: ticket.publicId,
        patch: { platform: 'EXTERNO' },
      }),
    );

    expect(mocks.updateTicket).toHaveBeenCalledWith(ticket.publicId, {
      platform: 'EXTERNO',
    });
    expect(client.getQueryData<Ticket[]>(listKey)?.[0].platform).toBe(
      'EXTERNO',
    );
    expect(client.getQueryData(conversationKey)).toEqual(conversation);
  });

  it('revierte el movimiento optimista si falla la actualización', async () => {
    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    const listKey = ticketKeys.list({});
    client.setQueryData(listKey, [ticket]);
    mocks.updateTicket.mockRejectedValue(new Error('falló'));
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useUpdateTicket(), { wrapper });

    await expect(
      act(() =>
        result.current.mutateAsync({
          publicId: ticket.publicId,
          patch: { status: 'RESUELTO' },
        }),
      ),
    ).rejects.toThrow('falló');
    expect(client.getQueryData<Ticket[]>(listKey)?.[0].status).toBe(
      'PENDIENTE',
    );
  });

  it('muestra el cambio de estado mientras la actualización sigue pendiente', async () => {
    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    const listKey = ticketKeys.list({});
    client.setQueryData(listKey, [ticket]);
    let resolveUpdate: (updatedTicket: Ticket) => void = () => undefined;
    mocks.updateTicket.mockReturnValue(
      new Promise<Ticket>((resolve) => {
        resolveUpdate = resolve;
      }),
    );
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useUpdateTicket(), { wrapper });

    act(() => {
      result.current.mutate({
        publicId: ticket.publicId,
        patch: { status: 'RESUELTO' },
      });
    });

    await waitFor(() => {
      expect(client.getQueryData<Ticket[]>(listKey)?.[0].status).toBe(
        'RESUELTO',
      );
    });

    await act(async () => {
      resolveUpdate({ ...ticket, status: 'RESUELTO' });
    });
  });
});
