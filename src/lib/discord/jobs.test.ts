// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { OutboxJob, Ticket } from '@/lib/types';

const mocks = vi.hoisted(() => ({
  archiveThread: vi.fn(),
  createPublicThread: vi.fn(),
  editThreadMessage: vi.fn(),
  findTicketControlMessageId: vi.fn(),
  findTicketThread: vi.fn(),
  hasTicketMessage: vi.fn(),
  renameThread: vi.fn(),
  sendThreadMessage: vi.fn(),
  getTicket: vi.fn(),
  getTicketImageSignedUrls: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock('@/lib/discord/client', () => ({
  archiveThread: mocks.archiveThread,
  createPublicThread: mocks.createPublicThread,
  DiscordApiError: class DiscordApiError extends Error {},
  editThreadMessage: mocks.editThreadMessage,
  findTicketControlMessageId: mocks.findTicketControlMessageId,
  findTicketThread: mocks.findTicketThread,
  hasTicketMessage: mocks.hasTicketMessage,
  renameThread: mocks.renameThread,
  sendThreadMessage: mocks.sendThreadMessage,
}));
vi.mock('@/lib/env/server', () => ({
  getDiscordEnv: () => ({ triagerRoleId: 'triager-role' }),
}));
vi.mock('@/lib/discord/roles', () => ({
  platformRoleId: () => 'platform-role',
}));
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ rpc: mocks.rpc }),
}));
vi.mock('@/lib/tickets/server', () => ({
  getTicket: mocks.getTicket,
  getTicketImageSignedUrls: mocks.getTicketImageSignedUrls,
}));

import { processOutboxJobs } from '@/lib/discord/jobs';

const ticket: Ticket = {
  id: 42,
  publicId: '3d7b8cb4-4eaf-4d9a-ae97-1c3c807d8c71',
  title: 'Error crítico',
  description: 'No carga',
  type: 'BUG',
  priority: 'MEDIA',
  status: 'EN_PROGRESO',
  platform: 'NESTOR',
  createdByName: 'Operaciones',
  createdByDiscordId: 'discord-user-1',
  discordThreadId: 'thread-1',
  images: [],
  createdAt: '2026-08-24T12:00:00.000Z',
  updatedAt: '2026-08-24T13:00:00.000Z',
};

function job(type: OutboxJob['type'], payload: Record<string, unknown>) {
  return {
    id: 'job-1',
    ticketPublicId: ticket.publicId,
    type,
    payload,
    status: 'PENDING',
    attempts: 0,
    nextAttemptAt: ticket.createdAt,
    lastError: null,
    lockedAt: null,
    deliveredAt: null,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
  } satisfies OutboxJob;
}

describe('Discord outbox jobs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getTicket.mockResolvedValue(ticket);
    mocks.getTicketImageSignedUrls.mockResolvedValue([]);
    mocks.renameThread.mockResolvedValue({
      id: 'thread-1',
      name: 'RTP-42: Error crítico',
    });
    mocks.sendThreadMessage.mockResolvedValue({ id: 'message-1' });
    mocks.findTicketControlMessageId.mockResolvedValue('control-message-1');
    mocks.editThreadMessage.mockResolvedValue({ id: 'control-message-1' });
  });

  it('renombra el thread y menciona al creador en actualizaciones web', async () => {
    mocks.rpc
      .mockResolvedValueOnce({
        data: [
          job('SEND_THREAD_MESSAGE', {
            threadId: 'thread-1',
            content: 'El ticket fue actualizado.',
          }),
        ],
        error: null,
      })
      .mockResolvedValueOnce({ data: null, error: null });

    await expect(processOutboxJobs()).resolves.toEqual({
      claimed: 1,
      delivered: 1,
      failed: 0,
    });
    expect(mocks.renameThread).toHaveBeenCalledWith(
      'thread-1',
      'RTP-42: Error crítico',
    );
    expect(mocks.sendThreadMessage).toHaveBeenCalledWith('thread-1', {
      content: '<@discord-user-1> El ticket fue actualizado.',
      allowed_mentions: { parse: [], users: ['discord-user-1'] },
    });
  });

  it('recupera y renombra un thread con el formato legacy', async () => {
    mocks.getTicket.mockResolvedValue({ ...ticket, discordThreadId: null });
    mocks.findTicketThread.mockResolvedValueOnce(null).mockResolvedValueOnce({
      id: 'thread-1',
      name: `ticket-${ticket.publicId}`,
    });
    mocks.hasTicketMessage.mockResolvedValue(true);
    mocks.rpc
      .mockResolvedValueOnce({
        data: [
          job('CREATE_TRIAGE_THREAD', { ticketPublicId: ticket.publicId }),
        ],
        error: null,
      })
      .mockResolvedValueOnce({ data: ticket, error: null })
      .mockResolvedValueOnce({ data: null, error: null });

    await expect(processOutboxJobs()).resolves.toMatchObject({ delivered: 1 });
    expect(mocks.findTicketThread).toHaveBeenNthCalledWith(
      1,
      'RTP-42: Error crítico',
    );
    expect(mocks.findTicketThread).toHaveBeenNthCalledWith(
      2,
      `ticket-${ticket.publicId}`,
    );
    expect(mocks.renameThread).toHaveBeenCalledWith(
      'thread-1',
      'RTP-42: Error crítico',
    );
    expect(mocks.createPublicThread).not.toHaveBeenCalled();
  });

  it('incluye las imágenes firmadas al publicar el ticket en el hilo', async () => {
    mocks.findTicketThread.mockResolvedValue({
      id: 'thread-1',
      name: 'RTP-42: Error crítico',
    });
    mocks.hasTicketMessage.mockResolvedValue(false);
    mocks.getTicketImageSignedUrls.mockResolvedValue([
      'https://storage.example/signed/image.png',
    ]);
    mocks.rpc
      .mockResolvedValueOnce({
        data: [
          job('CREATE_TRIAGE_THREAD', { ticketPublicId: ticket.publicId }),
        ],
        error: null,
      })
      .mockResolvedValueOnce({ data: null, error: null });

    await expect(processOutboxJobs()).resolves.toMatchObject({ delivered: 1 });
    expect(mocks.sendThreadMessage).toHaveBeenCalledWith(
      'thread-1',
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({
            image: { url: 'https://storage.example/signed/image.png' },
          }),
        ]),
      }),
    );
  });

  it('actualiza los controles con el rol de la nueva plataforma desde web', async () => {
    mocks.rpc
      .mockResolvedValueOnce({
        data: [
          job('SEND_THREAD_MESSAGE', {
            threadId: 'thread-1',
            syncControls: true,
            assignedBy: 'Operaciones',
          }),
        ],
        error: null,
      })
      .mockResolvedValueOnce({ data: null, error: null });

    await expect(processOutboxJobs()).resolves.toMatchObject({ delivered: 1 });
    expect(mocks.findTicketControlMessageId).toHaveBeenCalledWith(
      'thread-1',
      ticket.publicId,
    );
    expect(mocks.editThreadMessage).toHaveBeenCalledWith(
      'thread-1',
      'control-message-1',
      expect.objectContaining({
        content: expect.stringContaining('<@&platform-role>'),
        components: expect.any(Array),
      }),
    );
  });
});
