import { randomUUID } from 'node:crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import {
  DISCORD_OAUTH_STATE_COOKIE,
  discordAuthorizationUrl,
} from '@/lib/discord/oauth';
import { getServerEnv } from '@/lib/env/server';

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user)
    return NextResponse.redirect(new URL('/login', getServerEnv().APP_URL));

  const state = randomUUID();
  const cookieStore = await cookies();
  cookieStore.set(DISCORD_OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/api/discord/oauth',
    maxAge: 600,
  });

  return NextResponse.redirect(discordAuthorizationUrl(state));
}
