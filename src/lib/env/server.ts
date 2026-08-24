import 'server-only';
import { z } from 'zod';

const optionalString = z.string().min(1).optional();

const schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: optionalString,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: optionalString,
  SUPABASE_SECRET_KEY: optionalString,
  SUPABASE_SERVICE_ROLE_KEY: optionalString,
  AUTH_ALLOWED_GOOGLE_DOMAINS: z.string().default('rial-ai.com'),
  APP_URL: z.string().url().default('http://localhost:3000'),
  CRON_SECRET: optionalString,
  DISCORD_PUBLIC_KEY: optionalString,
  DISCORD_CLIENT_ID: optionalString,
  DISCORD_CLIENT_SECRET: optionalString,
  DISCORD_BOT_TOKEN: optionalString,
  DISCORD_GUILD_ID: optionalString,
  DISCORD_TRIAGE_CHANNEL_ID: optionalString,
  DISCORD_TRIAGER_ROLE_ID: optionalString,
  DISCORD_NESTOR_ROLE_ID: optionalString,
  DISCORD_DYLAN_ROLE_ID: optionalString,
  DISCORD_ATOM_ROLE_ID: optionalString,
  DISCORD_KAYS_ROLE_ID: optionalString,
  DISCORD_PANEL_MESSAGE_ID: optionalString,
});

export function getServerEnv() {
  const parsed = schema.parse(process.env);
  const publicKey =
    parsed.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    parsed.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const secretKey =
    parsed.SUPABASE_SECRET_KEY ?? parsed.SUPABASE_SERVICE_ROLE_KEY;

  if (!publicKey) throw new Error('Falta la clave pública de Supabase');
  if (!secretKey) throw new Error('Falta la clave servidor de Supabase');

  return { ...parsed, publicKey, secretKey };
}

export function getDiscordEnv() {
  const env = getServerEnv();
  const required = {
    publicKey: env.DISCORD_PUBLIC_KEY,
    botToken: env.DISCORD_BOT_TOKEN,
    guildId: env.DISCORD_GUILD_ID,
    triageChannelId: env.DISCORD_TRIAGE_CHANNEL_ID,
    triagerRoleId: env.DISCORD_TRIAGER_ROLE_ID,
    nestorRoleId: env.DISCORD_NESTOR_ROLE_ID,
    dylanRoleId: env.DISCORD_DYLAN_ROLE_ID,
    atomRoleId: env.DISCORD_ATOM_ROLE_ID,
    kaysRoleId: env.DISCORD_KAYS_ROLE_ID,
  };

  for (const [name, value] of Object.entries(required)) {
    if (!value) throw new Error(`Falta configuración Discord: ${name}`);
  }

  return required as { [Key in keyof typeof required]: string };
}

export function getDiscordOAuthEnv() {
  const env = getServerEnv();
  const required = {
    clientId: env.DISCORD_CLIENT_ID,
    clientSecret: env.DISCORD_CLIENT_SECRET,
  };

  for (const [name, value] of Object.entries(required)) {
    if (!value) throw new Error(`Falta configuración OAuth Discord: ${name}`);
  }

  return {
    ...(required as { [Key in keyof typeof required]: string }),
    redirectUri: new URL('/api/discord/oauth/callback', env.APP_URL).toString(),
  };
}
