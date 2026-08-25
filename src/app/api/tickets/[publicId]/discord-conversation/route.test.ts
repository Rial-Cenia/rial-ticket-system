// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getAuthenticatedUser: vi.fn(),
  getTicket: vi.fn(),
  getThreadMessages: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  getAuthenticatedUser: mocks.getAuthenticatedUser,
}));
vi.mock('@/lib/tickets/server', () => ({ getTicket: mocks.getTicket }));
vi.mock('@/lib/discord/client', () => ({
  getThreadMessages: mocks.getThreadMessages,
}));
vi.mock('@/lib/env/server', () => ({
  getDiscordEnv: () => ({ guildId: 'guild-1' }),
}));

import { GET } from '@/app/api/tickets/[publicId]/discord-conversation/route';

describe('ticket Discord conversation route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAuthenticatedUser.mockResolvedValue({
      id: 'user-1',
      name: 'Ana',
      email: 'ana@rial-ai.com',
    });
    mocks.getTicket.mockResolvedValue({
      publicId: 'ticket-1',
      discordThreadId: 'thread-1',
    });
    mocks.getThreadMessages.mockResolvedValue([
      { id: 'message-1', content: 'Hola' },
    ]);
  });

  it('requiere autenticación', async () => {
    mocks.getAuthenticatedUser.mockResolvedValue(null);

    const response = await GET(new Request('http://localhost'), {
      params: Promise.resolve({ publicId: 'ticket-1' }),
    });

    expect(response.status).toBe(401);
    expect(mocks.getThreadMessages).not.toHaveBeenCalled();
  });

  it('entrega mensajes y enlace al hilo del servidor configurado', async () => {
    const response = await GET(new Request('http://localhost'), {
      params: Promise.resolve({ publicId: 'ticket-1' }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: {
        threadUrl: 'https://discord.com/channels/guild-1/thread-1',
        messages: [{ id: 'message-1', content: 'Hola' }],
      },
    });
    expect(mocks.getThreadMessages).toHaveBeenCalledWith('thread-1');
  });
});
