import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Kanban } from '@/lib/types';

const mocks = vi.hoisted(() => ({
  updateMutate: vi.fn(),
  archiveMutate: vi.fn(),
  showToast: vi.fn(),
}));

vi.mock('@/hooks/use-kanbans', () => ({
  useUpdateKanbanCard: () => ({ mutate: mocks.updateMutate, error: null }),
  useArchiveFinalStateCards: () => ({
    mutate: mocks.archiveMutate,
    isPending: false,
  }),
}));

vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({ showToast: mocks.showToast }),
}));

import { TaskBoard } from '@/components/tasks/task-board';

const kanban: Kanban = {
  id: 'kanban-1',
  name: 'Producto',
  teams: [{ id: 'team-1', name: 'Equipo' }],
  states: [
    { id: 'state-start', kanbanId: 'kanban-1', name: 'Por hacer', position: 0 },
    { id: 'state-final', kanbanId: 'kanban-1', name: 'Listo', position: 1 },
  ],
  tags: [],
  members: [],
  cards: [
    {
      id: 'card-1',
      kanbanId: 'kanban-1',
      title: 'Cerrar flujo',
      description: '',
      stateId: 'state-final',
      priority: 'MEDIA',
      assignee: null,
      reviewer: null,
      tags: [],
      createdByUserId: 'user-1',
      createdAt: '2026-09-08T10:00:00.000Z',
      updatedAt: '2026-09-08T10:00:00.000Z',
    },
  ],
  canManage: true,
  canDeleteCards: true,
  createdAt: '2026-09-08T10:00:00.000Z',
  updatedAt: '2026-09-08T10:00:00.000Z',
};

describe('TaskBoard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  it('ofrece archivar tarjetas solo en el estado final', async () => {
    render(<TaskBoard kanban={kanban} onOpen={vi.fn()} />);

    await userEvent.click(
      screen.getByRole('button', {
        name: 'Archivar tarjetas del estado final',
      }),
    );

    expect(mocks.archiveMutate).toHaveBeenCalledWith(
      'state-final',
      expect.objectContaining({
        onSuccess: expect.any(Function),
        onError: expect.any(Function),
      }),
    );
  });
});
