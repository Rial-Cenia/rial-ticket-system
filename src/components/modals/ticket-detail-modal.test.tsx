import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Ticket } from '@/lib/types';

const mocks = vi.hoisted(() => ({
  update: vi.fn(),
  remove: vi.fn(),
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
}));

import { TicketDetailModal } from '@/components/modals/ticket-detail-modal';

const ticket: Ticket = {
  id: 42,
  publicId: 'ticket-1',
  title: 'Error al descargar',
  description: 'La descarga no comienza.',
  type: 'BUG',
  status: 'PENDIENTE',
  platform: 'NESTOR',
  createdByName: 'Ana',
  createdByDiscordId: 'discord-user-1',
  discordThreadId: 'thread-1',
  images: [],
  createdAt: '2026-08-25T10:00:00.000Z',
  updatedAt: '2026-08-25T10:30:00.000Z',
};

describe('ticket detail modal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.update.mockImplementation(async ({ patch }) => ({
      ...ticket,
      ...patch,
    }));
  });

  it('muestra el detalle y el chat antes de entrar a edición', () => {
    render(<TicketDetailModal ticket={ticket} onOpenChange={vi.fn()} />);

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
    render(<TicketDetailModal ticket={ticket} onOpenChange={vi.fn()} />);

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
});
