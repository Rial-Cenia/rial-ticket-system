// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getAuthenticatedUser: vi.fn(),
  linkDiscordAccount: vi.fn(),
  exchangeDiscordCode: vi.fn(),
  getCurrentDiscordUser: vi.fn(),
  getCurrentDiscordGuildMember: vi.fn(),
  cookieGet: vi.fn(),
  cookieSet: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  getAuthenticatedUser: mocks.getAuthenticatedUser,
}));
vi.mock('@/lib/discord/accounts', () => ({
  linkDiscordAccount: mocks.linkDiscordAccount,
}));
vi.mock('@/lib/discord/oauth', () => ({
  DISCORD_OAUTH_STATE_COOKIE: 'rial_discord_oauth_state',
  exchangeDiscordCode: mocks.exchangeDiscordCode,
  getCurrentDiscordUser: mocks.getCurrentDiscordUser,
  getCurrentDiscordGuildMember: mocks.getCurrentDiscordGuildMember,
}));
vi.mock('@/lib/env/server', () => ({
  getServerEnv: () => ({ APP_URL: 'https://tickets.example' }),
}));
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: mocks.cookieGet, set: mocks.cookieSet }),
}));

import { GET } from '@/app/api/discord/oauth/callback/route';

describe('Discord OAuth callback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAuthenticatedUser.mockResolvedValue({
      id: 'user-1',
      email: 'ana@rial-ai.com',
      name: 'Ana',
    });
    mocks.cookieGet.mockReturnValue({ value: 'state-1' });
    mocks.exchangeDiscordCode.mockResolvedValue('access-1');
    mocks.getCurrentDiscordUser.mockResolvedValue({
      id: '12345678901234567',
      username: 'ana',
    });
    mocks.getCurrentDiscordGuildMember.mockResolvedValue({
      roles: [],
      nick: 'Anita',
    });
  });

  it('vincula al usuario autenticado cuando state e identidad son válidos', async () => {
    const response = await GET(
      new Request(
        'https://tickets.example/api/discord/oauth/callback?code=code-1&state=state-1',
      ),
    );

    expect(mocks.linkDiscordAccount).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ id: '12345678901234567' }),
      expect.objectContaining({ nick: 'Anita' }),
    );
    expect(response.headers.get('location')).toBe(
      'https://tickets.example/discord?linked=true',
    );
  });

  it('rechaza state inválido y elimina la cookie con el mismo path', async () => {
    const response = await GET(
      new Request(
        'https://tickets.example/api/discord/oauth/callback?code=code-1&state=other',
      ),
    );

    expect(mocks.exchangeDiscordCode).not.toHaveBeenCalled();
    expect(mocks.cookieSet).toHaveBeenCalledWith(
      'rial_discord_oauth_state',
      '',
      expect.objectContaining({ path: '/api/discord/oauth', maxAge: 0 }),
    );
    expect(response.headers.get('location')).toBe(
      'https://tickets.example/discord?error=invalid_state',
    );
  });
});
