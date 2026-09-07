import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  kanbanTeams: [{ teamId: 'team-1' }],
  memberships: [{ id: 'membership-1' }],
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table === 'KanbanTeam') {
        let equalityCalls = 0;
        const query = {
          select: () => query,
          eq: () => {
            equalityCalls += 1;
            return equalityCalls === 2
              ? Promise.resolve({ data: mocks.kanbanTeams, error: null })
              : query;
          },
        };
        return query;
      }
      const query = {
        select: () => query,
        in: () => query,
        eq: () => query,
        limit: () => Promise.resolve({ data: mocks.memberships, error: null }),
      };
      return query;
    },
  }),
}));

import {
  requireAdmin,
  requireKanbanManager,
  requireKanbanMember,
} from '@/lib/kanbans/authorization';

describe('kanban authorization', () => {
  beforeEach(() => {
    mocks.kanbanTeams = [{ teamId: 'team-1' }];
    mocks.memberships = [{ id: 'membership-1' }];
  });

  it('permite acciones administrativas al rol ADMIN', () => {
    expect(() =>
      requireAdmin({
        id: 'admin',
        email: 'admin@rial.cl',
        name: 'Admin',
        role: 'ADMIN',
      }),
    ).not.toThrow();
  });

  it('rechaza acciones administrativas para usuarios comunes', () => {
    expect(() =>
      requireAdmin({
        id: 'user',
        email: 'user@rial.cl',
        name: 'User',
        role: 'USER',
      }),
    ).toThrow('No tienes permisos para realizar esta acción');
  });

  it('permite acceder al kanban cuando existe una membresía activa', async () => {
    await expect(
      requireKanbanMember(
        { id: 'user', email: 'user@rial.cl', name: 'User', role: 'USER' },
        'kanban-1',
      ),
    ).resolves.toBeUndefined();
  });

  it('rechaza acceso y administración sin membresía válida', async () => {
    mocks.memberships = [];
    const user = {
      id: 'user',
      email: 'user@rial.cl',
      name: 'User',
      role: 'USER',
    } as const;
    await expect(requireKanbanMember(user, 'kanban-1')).rejects.toThrow(
      'No tienes acceso a este kanban',
    );
    await expect(requireKanbanManager(user, 'kanban-1')).rejects.toThrow(
      'No tienes permisos para gestionar este kanban',
    );
  });
});
