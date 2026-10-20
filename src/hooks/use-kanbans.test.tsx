import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Kanban } from '@/lib/types';

const mocks = vi.hoisted(() => ({
  updateCard: vi.fn(),
}));

vi.mock('@/lib/api/kanbans', () => ({
  updateCard: mocks.updateCard,
}));

import { kanbanKeys, useUpdateKanbanCard } from '@/hooks/use-kanbans';

const kanban = {
  id: 'kanban-1',
  cards: [
    { id: 'card-1', stateId: 'state-start', title: 'Tarjeta' },
    { id: 'card-2', stateId: 'state-start', title: 'Otra tarjeta' },
  ],
} as Kanban;

function createClient() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  client.setQueryData(kanbanKeys.all, [kanban]);
  return client;
}

describe('useUpdateKanbanCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('mueve la tarjeta localmente mientras la actualización sigue pendiente', async () => {
    const client = createClient();
    mocks.updateCard.mockReturnValue(new Promise(() => undefined));
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useUpdateKanbanCard('kanban-1'), {
      wrapper,
    });

    act(() => {
      result.current.mutate({
        cardId: 'card-1',
        input: { stateId: 'state-final' },
      });
    });

    await waitFor(() => {
      expect(
        client.getQueryData<Kanban[]>(kanbanKeys.all)?.[0].cards[0].stateId,
      ).toBe('state-final');
    });
  });

  it('revierte el movimiento si falla la actualización', async () => {
    const client = createClient();
    mocks.updateCard.mockRejectedValue(new Error('falló'));
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useUpdateKanbanCard('kanban-1'), {
      wrapper,
    });

    await expect(
      act(() =>
        result.current.mutateAsync({
          cardId: 'card-1',
          input: { stateId: 'state-final' },
        }),
      ),
    ).rejects.toThrow('falló');
    expect(
      client.getQueryData<Kanban[]>(kanbanKeys.all)?.[0].cards[0].stateId,
    ).toBe('state-start');
  });
});
