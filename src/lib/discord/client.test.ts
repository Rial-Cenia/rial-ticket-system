// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/env/server', () => ({
  getDiscordEnv: () => ({
    botToken: 'bot-token',
    guildId: 'guild-1',
    triageChannelId: 'channel-1',
  }),
}));

import {
  createPublicThread,
  DiscordApiError,
  findTicketThread,
  sendThreadMessage,
} from '@/lib/discord/client';

describe('Discord REST client', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn()));
  afterEach(() => vi.unstubAllGlobals());

  it('crea un public thread tipo 11 en el canal de triage', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ id: 'thread-1', name: 'ticket-123' }), {
        status: 200,
      }),
    );

    await createPublicThread('ticket-123');

    expect(fetch).toHaveBeenCalledWith(
      'https://discord.com/api/v10/channels/channel-1/threads',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          name: 'ticket-123',
          type: 11,
          auto_archive_duration: 10080,
        }),
      }),
    );
  });

  it('recupera por nombre un thread archivado cuando no está activo', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ threads: [] }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ threads: [{ id: 'thread-1', name: 'ticket-123' }] }),
          { status: 200 },
        ),
      );

    await expect(findTicketThread('ticket-123')).resolves.toMatchObject({
      id: 'thread-1',
    });
  });

  it('expone retry_after en respuestas 429', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({ message: 'Rate limited', retry_after: 2.5 }),
        { status: 429 },
      ),
    );

    const request = sendThreadMessage('thread-1', { content: 'hola' });
    await expect(request).rejects.toBeInstanceOf(DiscordApiError);
    await expect(request).rejects.toMatchObject({
      status: 429,
      retryAfterSeconds: 2.5,
    });
  });
});
