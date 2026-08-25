import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ create: vi.fn() }));

vi.mock('@/hooks/use-tickets', () => ({
  useCreateTicket: () => ({
    mutateAsync: mocks.create,
    error: null,
    isPending: false,
  }),
}));

import { NewTicketModal } from '@/components/modals/new-ticket-modal';

describe('new ticket modal', () => {
  it('crea tickets con prioridad media por defecto', async () => {
    mocks.create.mockResolvedValue({});
    render(<NewTicketModal open onOpenChange={vi.fn()} />);

    expect(
      screen.getAllByText('✨ Importante, pero respiramos').length,
    ).toBeGreaterThan(0);
    await userEvent.type(screen.getByLabelText('Título'), 'Error de descarga');
    await userEvent.type(
      screen.getByLabelText('Descripción'),
      'La descarga no comienza.',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Crear ticket' }));

    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Error de descarga',
        priority: 'MEDIA',
      }),
    );
  });
});
