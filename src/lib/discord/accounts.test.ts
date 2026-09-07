// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getGuildMember: vi.fn(),
  listUsers: vi.fn(),
  selectLinks: vi.fn(),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    auth: { admin: { listUsers: mocks.listUsers } },
    from: () => ({ select: mocks.selectLinks }),
  }),
}));

vi.mock('@/lib/env/server', () => ({
  getDiscordEnv: () => ({ triagerRoleId: 'triager-role' }),
}));

vi.mock('@/lib/discord/client', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('@/lib/discord/client')>();
  return { ...original, getGuildMember: mocks.getGuildMember };
});

import { listDiscordLinkedUsers } from '@/lib/discord/accounts';
import { DiscordApiError } from '@/lib/discord/client';

describe('Discord accounts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listUsers.mockResolvedValue({
      data: {
        users: [
          {
            id: 'user-1',
            email: 'ana@rial-ai.com',
            user_metadata: { full_name: 'Ana' },
          },
        ],
      },
      error: null,
    });
    mocks.selectLinks.mockResolvedValue({
      data: [
        {
          userId: 'user-1',
          discordUserId: '12345678901234567',
          discordUsername: 'ana',
        },
      ],
      error: null,
    });
  });

  it('mantiene disponible la página si Discord continúa respondiendo 429', async () => {
    mocks.getGuildMember.mockRejectedValue(
      new DiscordApiError('Rate limited', 429, 1),
    );

    await expect(listDiscordLinkedUsers()).resolves.toEqual([
      expect.objectContaining({
        userId: 'user-1',
        isGuildMember: false,
        hasTriagerRole: false,
        membershipUnavailable: true,
      }),
    ]);
  });

  it('consulta las membresías en serie para evitar ráfagas al API de Discord', async () => {
    mocks.listUsers.mockResolvedValue({
      data: {
        users: [
          { id: 'user-1', email: 'ana@rial-ai.com', user_metadata: {} },
          { id: 'user-2', email: 'dani@rial-ai.com', user_metadata: {} },
        ],
      },
      error: null,
    });
    mocks.selectLinks.mockResolvedValue({
      data: [
        {
          userId: 'user-1',
          discordUserId: '12345678901234567',
          discordUsername: 'ana',
        },
        {
          userId: 'user-2',
          discordUserId: '22345678901234567',
          discordUsername: 'dani',
        },
      ],
      error: null,
    });

    let resolveFirst!: (value: { roles: string[] }) => void;
    mocks.getGuildMember
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirst = resolve;
          }),
      )
      .mockResolvedValueOnce({ roles: [] });

    const users = listDiscordLinkedUsers();
    await vi.waitFor(() =>
      expect(mocks.getGuildMember).toHaveBeenCalledTimes(1),
    );
    resolveFirst({ roles: ['triager-role'] });
    await users;

    expect(mocks.getGuildMember).toHaveBeenCalledTimes(2);
  });
});
