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
  addGuildMemberRole,
  createPublicThread,
  DiscordApiError,
  findTicketThread,
  getGuildMember,
  removeGuildMemberRole,
  renameThread,
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

  it('renombra un thread existente', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ id: 'thread-1', name: 'RTP-42: Error' }), {
        status: 200,
      }),
    );

    await renameThread('thread-1', 'RTP-42: Error');

    expect(fetch).toHaveBeenCalledWith(
      'https://discord.com/api/v10/channels/thread-1',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ name: 'RTP-42: Error' }),
      }),
    );
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

  it('consulta la membresía y traduce un 404 a miembro inexistente', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 404 }));

    await expect(getGuildMember('12345678901234567')).resolves.toBeNull();
  });

  it('agrega y quita el rol con trazabilidad para el audit log', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 204 }));

    await addGuildMemberRole('12345678901234567', 'role-1', 'Ana Pérez');
    await removeGuildMemberRole('12345678901234567', 'role-1', 'Ana Pérez');

    expect(fetch).toHaveBeenNthCalledWith(
      1,
      'https://discord.com/api/v10/guilds/guild-1/members/12345678901234567/roles/role-1',
      expect.objectContaining({
        method: 'PUT',
        headers: expect.any(Headers),
      }),
    );
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      'https://discord.com/api/v10/guilds/guild-1/members/12345678901234567/roles/role-1',
      expect.objectContaining({ method: 'DELETE' }),
    );
    const firstOptions = vi.mocked(fetch).mock.calls[0][1];
    expect(new Headers(firstOptions?.headers).get('x-audit-log-reason')).toBe(
      'Ticketera%20Rial%3A%20rol%20asignado%20por%20Ana%20P%C3%A9rez',
    );
  });
});
