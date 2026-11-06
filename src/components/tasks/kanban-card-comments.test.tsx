import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { KanbanCardComment } from '@/lib/types';

const mocks = vi.hoisted(() => ({
  comments: [
    {
      id: 'comment-1',
      kanbanCardId: 'card-1',
      parentCommentId: null,
      anchorText: null,
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
  ] as KanbanCardComment[],
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
    render(
      <KanbanCardComments
        kanbanId="kanban-1"
        cardId="card-1"
        description="Descripción de prueba"
      />,
    );

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
    render(
      <KanbanCardComments
        kanbanId="kanban-1"
        cardId="card-1"
        description="Descripción de prueba"
      />,
    );

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

  it('ancla el comentario a las líneas seleccionadas de la descripción', async () => {
    const user = userEvent.setup();
    render(
      <KanbanCardComments
        kanbanId="kanban-1"
        cardId="card-1"
        description="Primera línea para revisar."
      />,
    );

    const description = screen.getByText('Primera línea para revisar.');
    const range = document.createRange();
    range.selectNodeContents(description);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    fireEvent.mouseUp(description);

    expect(screen.getByText(/Comentario sobre:/)).toHaveTextContent(
      'Primera línea para revisar.',
    );
    await user.type(
      screen.getByPlaceholderText('Escribe un comentario…'),
      'Revisar este punto',
    );
    await user.click(screen.getByRole('button', { name: 'Publicar' }));

    const formData = mocks.create.mock.calls[0][0] as FormData;
    expect(formData.get('anchorText')).toBe('Primera línea para revisar.');
  });

  it('abre el editor de respuesta junto al comentario elegido', async () => {
    const user = userEvent.setup();
    render(
      <KanbanCardComments
        kanbanId="kanban-1"
        cardId="card-1"
        description="Descripción de prueba"
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Responder' }));
    expect(screen.getByText('Respondiendo a Beatriz')).toBeInTheDocument();

    await user.type(
      screen.getByPlaceholderText('Escribe un comentario…'),
      'Respuesta en contexto',
    );
    await user.click(screen.getByRole('button', { name: 'Publicar' }));

    const formData = mocks.create.mock.calls[0][0] as FormData;
    expect(formData.get('parentCommentId')).toBe('comment-1');
    expect(formData.get('content')).toBe('Respuesta en contexto');
  });

  it('muestra cada respuesta dentro de su comentario padre', () => {
    mocks.comments = [
      {
        id: 'parent',
        kanbanCardId: 'card-1',
        parentCommentId: null,
        anchorText: null,
        content: 'Comentario raíz',
        createdBy: { userId: 'user-1', name: 'Beatriz' },
        createdAt: '2026-10-13T12:00:00.000Z',
        attachments: [],
        canDelete: true,
      },
      {
        id: 'reply',
        kanbanCardId: 'card-1',
        parentCommentId: 'parent',
        anchorText: null,
        content: 'Respuesta del primer hilo',
        createdBy: { userId: 'user-2', name: 'Dylan' },
        createdAt: '2026-10-13T12:01:00.000Z',
        attachments: [],
        canDelete: true,
      },
      {
        id: 'other-parent',
        kanbanCardId: 'card-1',
        parentCommentId: null,
        anchorText: null,
        content: 'Otro comentario raíz',
        createdBy: { userId: 'user-3', name: 'Pipo' },
        createdAt: '2026-10-13T12:02:00.000Z',
        attachments: [],
        canDelete: true,
      },
    ];
    render(
      <KanbanCardComments
        kanbanId="kanban-1"
        cardId="card-1"
        description="Descripción de prueba"
      />,
    );

    expect(
      within(screen.getByTestId('comment-parent')).getByTestId('comment-reply'),
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId('comment-other-parent')).queryByTestId(
        'comment-reply',
      ),
    ).not.toBeInTheDocument();
  });
});
