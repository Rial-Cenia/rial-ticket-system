import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireKanbanManager: vi.fn(),
  finalState: { id: 'state-final' },
  archivedCards: [{ id: 'card-1' }, { id: 'card-2' }],
  cardTagUpdate: vi.fn(),
}));

vi.mock('@/lib/kanbans/authorization', () => ({
  getLeaderTeamIds: vi.fn(),
  requireKanbanManager: mocks.requireKanbanManager,
  requireKanbanMember: vi.fn(),
  requireLeader: vi.fn(),
}));

vi.mock('@/lib/users/server', () => ({ listUserDirectory: vi.fn() }));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table === 'KanbanState') {
        const query = {
          select: () => query,
          eq: () => query,
          order: () => query,
          limit: () => query,
          maybeSingle: () =>
            Promise.resolve({ data: mocks.finalState, error: null }),
        };
        return query;
      }
      if (table === 'KanbanCard') {
        const query = {
          update: () => query,
          eq: () => query,
          select: () =>
            Promise.resolve({ data: mocks.archivedCards, error: null }),
        };
        return query;
      }
      const query = {
        update: () => query,
        in: () => query,
        eq: mocks.cardTagUpdate,
      };
      return query;
    },
  }),
}));

import { archiveFinalStateCards } from '@/lib/kanbans/server';

const actor = {
  id: 'user-1',
  email: 'user@rial.cl',
  name: 'User',
  role: 'ADMIN',
} as const;

describe('archiveFinalStateCards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.finalState = { id: 'state-final' };
    mocks.archivedCards = [{ id: 'card-1' }, { id: 'card-2' }];
    mocks.cardTagUpdate.mockResolvedValue({ error: null });
  });

  it('cancela las tarjetas activas del estado final y sus etiquetas', async () => {
    await expect(
      archiveFinalStateCards(actor, 'kanban-1', 'state-final'),
    ).resolves.toEqual({ stateId: 'state-final', archivedCount: 2 });

    expect(mocks.requireKanbanManager).toHaveBeenCalledWith(actor, 'kanban-1');
    expect(mocks.cardTagUpdate).toHaveBeenCalledWith('status', 'ACTIVE');
  });

  it('rechaza estados que no son el último estado activo', async () => {
    await expect(
      archiveFinalStateCards(actor, 'kanban-1', 'state-middle'),
    ).rejects.toThrow('Solo puedes archivar tarjetas del estado final');
    expect(mocks.cardTagUpdate).not.toHaveBeenCalled();
  });
});
