import 'server-only';
import { getDiscordEnv } from '@/lib/env/server';
import type { Platform } from '@/lib/types';
import { createAdminClient } from '@/lib/supabase/admin';

export function platformRoleId(platform: Platform) {
  const env = getDiscordEnv();
  const roles: Record<Platform, string | null> = {
    NESTOR: env.nestorRoleId,
    DYLAN: env.dylanRoleId,
    ATOM: env.atomRoleId,
    KAYS: env.kaysRoleId,
    EXTERNO: null,
  };
  return roles[platform];
}

export async function resolvePlatformRoleId(platform: Platform) {
  const { data, error } = await createAdminClient()
    .from('DiscordRoleConnection')
    .select('roleId')
    .eq('platform', platform)
    .eq('status', 'ACTIVE')
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.roleId ?? platformRoleId(platform);
}
