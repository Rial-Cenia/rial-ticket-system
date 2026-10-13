import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  comments: [
    {
      id: 'comment-1',
      kanbanCardId: 'card-1',
      content: 'Revisa la [documentación](https://rial-ai.com).',
      createdBy: { userId: 'user-1', name: 'Beatriz' },
      createdAt: '2026-10-13T12:00:00.000Z',
      attachments: [
        {
          id: 'attachment-1',
          fileName: 'brief.pdf',
          mimeType: 'application/pdf',
          size: 1024,
          url: '/api/attachment-1',
          createdAt: '2026-10-13T12:00:00.000Z',
        },
      ],
      canDelete: true,
    },
  ],
  create: vi.fn(),
  remove: vi.fn(),
  showToast: vi.fn(),
}));

vi.mock('@/hooks/use-kanbans', () => ({
  useKanbanCardComments: () => ({
    data: mocks.comments,
    isLoading: false,
    error: null,
  }),
  useCreateKanbanCardComment: () => ({
    mutateAsync: mocks.create,
    isPending: false,
  }),
  useDeleteKanbanCardComment: () => ({
    mutateAsync: mocks.remove,
    isPending: false,
  }),
}));

vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({ showToast: mocks.showToast }),
}));

import { KanbanCardComments } from '@/components/tasks/kanban-card-comments';

describe('KanbanCardComments', () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.create.mockResolvedValue({});
  });

  it('muestra el hilo con links y adjuntos privados', () => {
    render(<KanbanCardComments kanbanId="kanban-1" cardId="card-1" />);

    expect(screen.getByText('Beatriz')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'documentación' })).toHaveAttribute(
      'href',
      'https://rial-ai.com',
    );
    expect(screen.getByRole('link', { name: /brief.pdf/ })).toHaveAttribute(
      'href',
      '/api/attachment-1',
    );
  });

  it('publica texto y archivos como datos de formulario', async () => {
    const user = userEvent.setup();
    render(<KanbanCardComments kanbanId="kanban-1" cardId="card-1" />);

    await user.type(
      screen.getByPlaceholderText('Escribe un comentario…'),
      '¿Puedes revisar este cambio?',
    );
    const file = new File(['content'], 'brief.pdf', {
      type: 'application/pdf',
    });
    await user.upload(screen.getByLabelText('Adjuntar archivos'), file);
    await user.click(screen.getByRole('button', { name: 'Publicar' }));

    expect(mocks.create).toHaveBeenCalledTimes(1);
    const formData = mocks.create.mock.calls[0][0] as FormData;
    expect(formData.get('content')).toBe('¿Puedes revisar este cambio?');
    expect(formData.getAll('attachments')).toEqual([file]);
  });
});
