import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireKanbanManager: vi.fn(),
  sourceTeams: [{ teamId: 'team-shared' }],
  targetTeams: [{ teamId: 'team-shared' }],
  teamQueryCalls: 0,
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
      if (table === 'KanbanTeam') {
        const query = {
          select: () => query,
          eq: (field: string) =>
            field === 'status'
              ? Promise.resolve({
                  data:
                    mocks.teamQueryCalls++ === 0
                      ? mocks.sourceTeams
                      : mocks.targetTeams,
                  error: null,
                })
              : query,
        };
        return query;
      }
      const query = {
        insert: () => query,
        select: () => query,
        single: () =>
          Promise.resolve({
            data: {
              id: 'connection-1',
              sourceKanbanId: 'kanban-a',
              targetKanbanId: 'kanban-b',
            },
            error: null,
          }),
      };
      return query;
    },
  }),
}));

import { createKanbanConnection } from '@/lib/kanbans/server';

const actor = {
  id: 'user-1',
  email: 'user@rial.cl',
  name: 'User',
  role: 'USER',
} as const;

describe('createKanbanConnection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireKanbanManager.mockResolvedValue(undefined);
    mocks.sourceTeams = [{ teamId: 'team-shared' }];
    mocks.targetTeams = [{ teamId: 'team-shared' }];
    mocks.teamQueryCalls = 0;
  });

  it('crea una conexión dirigida entre kanbans del mismo equipo', async () => {
    await expect(
      createKanbanConnection(actor, 'kanban-a', 'kanban-b'),
    ).resolves.toMatchObject({
      sourceKanbanId: 'kanban-a',
      targetKanbanId: 'kanban-b',
    });
    expect(mocks.requireKanbanManager).toHaveBeenNthCalledWith(
      1,
      actor,
      'kanban-a',
    );
    expect(mocks.requireKanbanManager).toHaveBeenNthCalledWith(
      2,
      actor,
      'kanban-b',
    );
  });

  it('rechaza kanbans sin un equipo compartido', async () => {
    mocks.targetTeams = [{ teamId: 'team-other' }];
    await expect(
      createKanbanConnection(actor, 'kanban-a', 'kanban-b'),
    ).rejects.toThrow('deben compartir al menos un equipo');
  });

  it('rechaza conectarse consigo mismo', async () => {
    await expect(
      createKanbanConnection(actor, 'kanban-a', 'kanban-a'),
    ).rejects.toThrow('no puede conectarse consigo mismo');
    expect(mocks.requireKanbanManager).not.toHaveBeenCalled();
  });
});
