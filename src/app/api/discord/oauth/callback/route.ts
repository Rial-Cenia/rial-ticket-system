import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { linkDiscordAccount } from '@/lib/discord/accounts';
import {
  exchangeDiscordCode,
  DISCORD_OAUTH_STATE_COOKIE,
  getCurrentDiscordGuildMember,
  getCurrentDiscordUser,
} from '@/lib/discord/oauth';
import { getServerEnv } from '@/lib/env/server';

function discordPage(params: Record<string, string>) {
  const url = new URL('/discord', getServerEnv().APP_URL);
  for (const [key, value] of Object.entries(params))
    url.searchParams.set(key, value);
  return url;
}

export async function GET(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.redirect(discordPage({ error: 'auth' }));

  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const state = requestUrl.searchParams.get('state');
  const oauthError = requestUrl.searchParams.get('error');
  const cookieStore = await cookies();
  const expectedState = cookieStore.get(DISCORD_OAUTH_STATE_COOKIE)?.value;
  cookieStore.set(DISCORD_OAUTH_STATE_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/api/discord/oauth',
    maxAge: 0,
  });

  if (oauthError)
    return NextResponse.redirect(discordPage({ error: 'cancelled' }));
  if (!code || !state || !expectedState || state !== expectedState)
    return NextResponse.redirect(discordPage({ error: 'invalid_state' }));

  try {
    const accessToken = await exchangeDiscordCode(code);
    const [discordUser, member] = await Promise.all([
      getCurrentDiscordUser(accessToken),
      getCurrentDiscordGuildMember(accessToken),
    ]);
    await linkDiscordAccount(user.id, discordUser, member);
    return NextResponse.redirect(discordPage({ linked: 'true' }));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error inesperado';
    return NextResponse.redirect(discordPage({ error: message }));
  }
}
