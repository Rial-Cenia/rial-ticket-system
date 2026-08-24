import 'server-only';
import { getDiscordEnv } from '@/lib/env/server';
import type { Platform } from '@/lib/types';

export function platformRoleId(platform: Platform) {
  const env = getDiscordEnv();
  return {
    NESTOR: env.nestorRoleId,
    DYLAN: env.dylanRoleId,
    ATOM: env.atomRoleId,
    KAYS: env.kaysRoleId,
  }[platform];
}
