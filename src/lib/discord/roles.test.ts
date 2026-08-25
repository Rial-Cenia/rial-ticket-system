// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/env/server', () => ({
  getDiscordEnv: () => ({
    nestorRoleId: 'nestor-role',
    dylanRoleId: 'dylan-role',
    atomRoleId: 'atom-role',
    kaysRoleId: 'kays-role',
  }),
}));

import { platformRoleId } from '@/lib/discord/roles';

describe('Discord platform roles', () => {
  it('no exige un rol de Discord para tickets externos', () => {
    expect(platformRoleId('NESTOR')).toBe('nestor-role');
    expect(platformRoleId('EXTERNO')).toBeNull();
  });
});
