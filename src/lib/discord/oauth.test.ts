// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/env/server', () => ({
  getDiscordOAuthEnv: () => ({
    clientId: 'client-1',
    clientSecret: 'secret-1',
    redirectUri: 'https://tickets.example/api/discord/oauth/callback',
  }),
  getDiscordEnv: () => ({ guildId: 'guild-1' }),
}));

import {
  discordAuthorizationUrl,
  exchangeDiscordCode,
  getCurrentDiscordGuildMember,
  getCurrentDiscordUser,
} from '@/lib/discord/oauth';

describe('Discord OAuth', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn()));
  afterEach(() => vi.unstubAllGlobals());

  it('crea una autorización con state y los scopes mínimos', () => {
    const url = new URL(discordAuthorizationUrl('state-1'));

    expect(url.origin + url.pathname).toBe(
      'https://discord.com/oauth2/authorize',
    );
    expect(url.searchParams.get('state')).toBe('state-1');
    expect(url.searchParams.get('scope')).toBe('identify guilds.members.read');
    expect(url.searchParams.get('redirect_uri')).toBe(
      'https://tickets.example/api/discord/oauth/callback',
    );
  });

  it('intercambia el código sin exponer el secreto en la URL', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({ access_token: 'access-1', token_type: 'Bearer' }),
        { status: 200 },
      ),
    );

    await expect(exchangeDiscordCode('code-1')).resolves.toBe('access-1');
    const [url, options] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe('https://discord.com/api/v10/oauth2/token');
    expect(String(options?.body)).toContain('client_secret=secret-1');
    expect(String(url)).not.toContain('secret-1');
  });

  it('verifica identidad y pertenencia al servidor con el token temporal', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: '12345678901234567',
            username: 'ana',
            global_name: 'Ana',
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ roles: ['role-1'], nick: 'Anita' }), {
          status: 200,
        }),
      );

    await expect(getCurrentDiscordUser('access-1')).resolves.toMatchObject({
      id: '12345678901234567',
    });
    await expect(
      getCurrentDiscordGuildMember('access-1'),
    ).resolves.toMatchObject({ nick: 'Anita' });
    expect(fetch).toHaveBeenLastCalledWith(
      'https://discord.com/api/v10/users/@me/guilds/guild-1/member',
      expect.objectContaining({
        headers: { authorization: 'Bearer access-1' },
      }),
    );
  });
});
