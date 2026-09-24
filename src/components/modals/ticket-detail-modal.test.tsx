import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Ticket } from '@/lib/types';

const mocks = vi.hoisted(() => ({
  update: vi.fn(),
  remove: vi.fn(),
  kanbans: [] as unknown[],
}));

vi.mock('@/hooks/use-tickets', () => ({
  useUpdateTicket: () => ({
    mutateAsync: mocks.update,
    error: null,
    isPending: false,
  }),
  useDeleteTicket: () => ({
    mutateAsync: mocks.remove,
    error: null,
    isPending: false,
  }),
  useDiscordConversation: () => ({
    data: {
      threadUrl: 'https://discord.com/channels/guild-1/thread-1',
      messages: [
        {
          id: 'message-1',
          authorName: 'Dani',
          isBot: false,
          content: 'Ya pude reproducir el problema.',
          attachments: [],
          createdAt: '2026-08-25T11:00:00.000Z',
        },
      ],
    },
    error: null,
    isLoading: false,
  }),
  useTicketKanbans: () => ({ data: [], error: null }),
}));

vi.mock('@/hooks/use-kanbans', () => ({
  useKanbans: () => ({ data: mocks.kanbans, error: null }),
}));

import { TicketDetailModal } from '@/components/modals/ticket-detail-modal';

const ticket: Ticket = {
  id: 42,
  publicId: 'ticket-1',
  title: 'Error al descargar',
  description: 'La descarga no comienza.',
  type: 'BUG',
  priority: 'MEDIA',
  status: 'PENDIENTE',
  platform: 'NESTOR',
  createdByName: 'Ana',
  createdByDiscordId: 'discord-user-1',
  discordThreadId: 'thread-1',
  images: [],
  createdAt: '2026-08-25T10:00:00.000Z',
  updatedAt: '2026-08-25T10:30:00.000Z',
};

function renderModal(selectedTicket: Ticket = ticket) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <TicketDetailModal ticket={selectedTicket} onOpenChange={vi.fn()} />
    </QueryClientProvider>,
  );
}

describe('ticket detail modal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.update.mockImplementation(async ({ patch }) => ({
      ...ticket,
      ...patch,
    }));
  });

  it('muestra el detalle y el chat antes de entrar a edición', () => {
    renderModal();

    expect(screen.getByText('Error al descargar')).toBeInTheDocument();
    expect(screen.getByText('La descarga no comienza.')).toBeInTheDocument();
    expect(
      screen.getByText('Ya pude reproducir el problema.'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /Abrir en Discord/ }),
    ).toHaveAttribute('href', 'https://discord.com/channels/guild-1/thread-1');
    expect(screen.queryByLabelText('Título')).not.toBeInTheDocument();
  });

  it('activa la edición con el lápiz y conserva abierto el detalle al guardar', async () => {
    renderModal();

    await userEvent.click(
      screen.getByRole('button', { name: 'Editar ticket' }),
    );
    const title = screen.getByLabelText('Título');
    await userEvent.clear(title);
    await userEvent.type(title, 'Error corregido');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        publicId: 'ticket-1',
        patch: expect.objectContaining({ title: 'Error corregido' }),
      }),
    );
    expect(await screen.findByText('Error corregido')).toBeInTheDocument();
  });

  it('muestra documentos como enlaces en vez de previews de imagen', () => {
    renderModal({
      ...ticket,
      images: [
        {
          id: 'document-1',
          fileName: 'Template_producto.xlsx',
          mimeType:
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          size: 1024,
          url: '/api/tickets/ticket-1/images/document-1',
          createdAt: '2026-08-25T10:15:00.000Z',
        },
      ],
    });

    expect(
      screen.getByRole('link', { name: 'Template_producto.xlsx' }),
    ).toHaveAttribute('href', '/api/tickets/ticket-1/images/document-1');
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('muestra las tarjetas visibles creadas desde el ticket', () => {
    mocks.kanbans = [
      {
        id: 'kanban-1',
        name: 'Producto',
        teams: [],
        states: [],
        tags: [],
        members: [],
        canManage: false,
        canDeleteCards: false,
        createdAt: ticket.createdAt,
        updatedAt: ticket.updatedAt,
        cards: [
          {
            id: 'card-1',
            kanbanId: 'kanban-1',
            title: 'Revisar descarga',
            description: '',
            stateId: 'state-1',
            priority: 'MEDIA',
            assignee: null,
            reviewer: null,
            tags: [],
            createdByUserId: 'user-1',
            createdAt: ticket.createdAt,
            updatedAt: ticket.updatedAt,
            ticketPublicId: ticket.publicId,
          },
        ],
      },
    ];

    renderModal();

    expect(
      screen.getByText('Tarjetas creadas desde este ticket'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Revisar descarga/ }),
    ).toBeInTheDocument();
  });
});
