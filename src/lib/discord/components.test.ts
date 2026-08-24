import { describe, expect, it } from 'vitest';
import { ticketControls, triageMessage } from '@/lib/discord/components';
import type { Ticket } from '@/lib/types';

const ticket: Ticket = {
  id: 42,
  publicId: '3d7b8cb4-4eaf-4d9a-ae97-1c3c807d8c71',
  title: 'Error crítico',
  description: 'No carga',
  type: 'BUG',
  status: 'EN_PROGRESO',
  platform: 'NESTOR',
  createdByName: 'Operaciones',
  createdByDiscordId: 'creator-1',
  discordThreadId: 'thread-1',
  createdAt: '2026-08-24T12:00:00.000Z',
  updatedAt: '2026-08-24T13:00:00.000Z',
};

describe('Discord ticket components', () => {
  it('muestra el código RTP en los mensajes', () => {
    expect(JSON.stringify(triageMessage(ticket, 'triager-role'))).toContain(
      'RTP-42',
    );
    expect(
      JSON.stringify(ticketControls(ticket, 'Operaciones', 'platform-role')),
    ).toContain('RTP-42');
  });

  it('incluye botones para los cuatro estados', () => {
    const payload = JSON.stringify(
      ticketControls(ticket, 'Operaciones', 'platform-role'),
    );
    for (const status of [
      'PENDIENTE',
      'EN_PROGRESO',
      'EN_STAGING',
      'EN_ESPERA',
      'RESUELTO',
    ]) {
      expect(payload).toContain(`status_${status}_${ticket.publicId}`);
    }
  });
});
