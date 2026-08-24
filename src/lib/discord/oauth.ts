import 'server-only';
import { z } from 'zod';
import { getDiscordEnv, getDiscordOAuthEnv } from '@/lib/env/server';
import type { DiscordGuildMember, DiscordUser } from '@/lib/discord/types';

const API = 'https://discord.com/api/v10';
export const DISCORD_OAUTH_STATE_COOKIE = 'rial_discord_oauth_state';

const tokenSchema = z.object({
  access_token: z.string().min(1),
  token_type: z.string().min(1),
});

const userSchema = z.object({
  id: z.string().regex(/^\d{17,20}$/),
  username: z.string().min(1).max(100),
  global_name: z.string().nullable().optional(),
  avatar: z.string().nullable().optional(),
});

const memberSchema = z.object({
  roles: z.array(z.string()),
  nick: z.string().nullable().optional(),
});

export function discordAuthorizationUrl(state: string) {
  const { clientId, redirectUri } = getDiscordOAuthEnv();
  const url = new URL('https://discord.com/oauth2/authorize');
  url.search = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: 'identify guilds.members.read',
    state,
    prompt: 'consent',
  }).toString();
  return url.toString();
}

export async function exchangeDiscordCode(code: string) {
  const { clientId, clientSecret, redirectUri } = getDiscordOAuthEnv();
  const response = await fetch(`${API}/oauth2/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
    }),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error('Discord rechazó la autorización');
  return tokenSchema.parse(await response.json()).access_token;
}

async function oauthRequest<T>(
  path: string,
  accessToken: string,
  schema: z.ZodType<T>,
) {
  const response = await fetch(`${API}${path}`, {
    headers: { authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });
  if (!response.ok) {
    if (response.status === 404)
      throw new Error(
        'La cuenta de Discord no pertenece al servidor configurado',
      );
    throw new Error('No fue posible verificar la cuenta en Discord');
  }
  return schema.parse(await response.json());
}

export function getCurrentDiscordUser(
  accessToken: string,
): Promise<DiscordUser> {
  return oauthRequest('/users/@me', accessToken, userSchema);
}

export function getCurrentDiscordGuildMember(
  accessToken: string,
): Promise<DiscordGuildMember> {
  const { guildId } = getDiscordEnv();
  return oauthRequest(
    `/users/@me/guilds/${guildId}/member`,
    accessToken,
    memberSchema,
  );
}
