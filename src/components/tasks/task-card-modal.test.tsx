import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Kanban, KanbanCard } from '@/lib/types';

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  update: vi.fn(),
  cancel: vi.fn(),
  transfer: vi.fn(),
  showToast: vi.fn(),
}));

vi.mock('@/hooks/use-kanbans', () => ({
  useCreateKanbanCard: () => ({ mutateAsync: mocks.create, isPending: false }),
  useUpdateKanbanCard: () => ({ mutateAsync: mocks.update, isPending: false }),
  useCancelKanbanCard: () => ({ mutateAsync: mocks.cancel, isPending: false }),
  useTransferKanbanCard: () => ({
    mutateAsync: mocks.transfer,
    isPending: false,
  }),
}));

vi.mock('@/hooks/use-tickets', () => ({
  useTicket: () => ({ data: null, isLoading: false, error: null }),
}));

vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({ showToast: mocks.showToast }),
}));

import { TaskCardModal } from '@/components/tasks/task-card-modal';

const card: KanbanCard = {
  id: 'card-1',
  kanbanId: 'kanban-1',
  title: 'Revisar integración',
  description: '**Validar** el flujo completo.',
  stateId: 'state-start',
  priority: 'ALTA',
  assignee: null,
  reviewer: null,
  tags: [],
  createdByUserId: 'user-1',
  createdAt: '2026-09-08T10:00:00.000Z',
  updatedAt: '2026-09-08T10:30:00.000Z',
};

const linkedCard: KanbanCard = {
  ...card,
  id: 'card-from-ticket',
  ticketPublicId: 'ticket-42',
};

const kanban: Kanban = {
  id: 'kanban-1',
  name: 'Producto',
  teams: [],
  states: [
    { id: 'state-start', kanbanId: 'kanban-1', name: 'Por hacer', position: 0 },
  ],
  tags: [],
  members: [],
  cards: [card],
  canManage: true,
  canDeleteCards: true,
  createdAt: '2026-09-08T10:00:00.000Z',
  updatedAt: '2026-09-08T10:30:00.000Z',
};

describe('TaskCardModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('muestra preview antes de permitir editar la tarjeta', async () => {
    render(
      <TaskCardModal kanban={kanban} card={card} open onOpenChange={vi.fn()} />,
    );

    expect(screen.getByText('Revisar integración')).toBeInTheDocument();
    expect(screen.getByText('Validar')).toBeInTheDocument();
    expect(screen.queryByLabelText('Título')).not.toBeInTheDocument();

    await userEvent.click(
      screen.getByRole('button', { name: 'Ver en pantalla completa' }),
    );
    expect(
      screen.getByRole('button', { name: 'Salir de pantalla completa' }),
    ).toBeInTheDocument();

    const editButtons = screen.getAllByRole('button', {
      name: 'Editar tarjeta',
    });
    await userEvent.click(editButtons.at(-1)!);
    expect(screen.getByDisplayValue('Revisar integración')).toBeInTheDocument();
    expect(screen.getByLabelText('Título')).toBeInTheDocument();
  });

  it('indica cuando la tarjeta viene de un ticket', () => {
    render(
      <TaskCardModal
        kanban={kanban}
        card={linkedCard}
        open
        onOpenChange={vi.fn()}
      />,
    );

    expect(screen.getByText('Viene de un ticket')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Vista previa/ }),
    ).toBeInTheDocument();
  });
});
