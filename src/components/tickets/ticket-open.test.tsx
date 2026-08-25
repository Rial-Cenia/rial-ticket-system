import { DndContext } from '@dnd-kit/core';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TicketCard } from '@/components/kanban/ticket-card';
import { TicketTable } from '@/components/tickets/ticket-table';
import type { Ticket } from '@/lib/types';

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
  createdByDiscordId: null,
  discordThreadId: null,
  images: [],
  createdAt: '2026-08-25T10:00:00.000Z',
  updatedAt: '2026-08-25T10:30:00.000Z',
};

describe('ticket detail triggers', () => {
  it('abre el detalle desde toda la tarjeta Kanban', () => {
    const onOpen = vi.fn();
    render(
      <DndContext>
        <TicketCard ticket={ticket} onOpen={onOpen} />
      </DndContext>,
    );

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Abrir detalle de Error al descargar',
      }),
    );

    expect(onOpen).toHaveBeenCalledWith(ticket);
  });

  it('abre el detalle al hacer click o presionar Enter en la fila', () => {
    const onOpen = vi.fn();
    const table = render(<TicketTable tickets={[ticket]} onOpen={onOpen} />);
    const row = table.container.querySelector('tbody tr');
    expect(row).not.toBeNull();

    fireEvent.click(row!);
    fireEvent.keyDown(row!, { key: 'Enter' });

    expect(onOpen).toHaveBeenCalledTimes(2);
    expect(onOpen).toHaveBeenLastCalledWith(ticket);
  });
});
