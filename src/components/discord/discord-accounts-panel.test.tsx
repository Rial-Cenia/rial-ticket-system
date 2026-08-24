import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DiscordAccountsPanel } from '@/components/discord/discord-accounts-panel';
import type { DiscordLinkedUser } from '@/lib/types';

const linkedUser: DiscordLinkedUser = {
  userId: 'user-1',
  email: 'ana@rial-ai.com',
  name: 'Ana',
  link: {
    userId: 'user-1',
    discordUserId: '12345678901234567',
    discordUsername: 'ana',
    discordDisplayName: 'Ana Discord',
    discordAvatarHash: null,
    guildNickname: 'Anita',
    linkedAt: '2026-08-24T12:00:00.000Z',
    updatedAt: '2026-08-24T12:00:00.000Z',
  },
  isGuildMember: true,
  hasTriagerRole: false,
};

describe('Discord accounts panel', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('permite asignar Barbilla roja a una cuenta vinculada', async () => {
    const updated = { ...linkedUser, hasTriagerRole: true };
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ data: { enabled: true } }), {
            status: 200,
          }),
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ data: [updated] }), { status: 200 }),
        ),
    );

    render(
      <DiscordAccountsPanel
        currentUserId="user-1"
        initialStatus={{}}
        initialUsers={[linkedUser]}
      />,
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Asignar Barbilla roja' }),
    );

    expect(fetch).toHaveBeenNthCalledWith(
      1,
      '/api/discord/accounts/user-1/role',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ enabled: true }),
      }),
    );
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Quitar rol' }),
      ).toBeInTheDocument(),
    );
  });

  it('ofrece OAuth cuando la cuenta actual no está vinculada', () => {
    render(
      <DiscordAccountsPanel
        currentUserId="user-2"
        initialStatus={{}}
        initialUsers={[
          {
            userId: 'user-2',
            email: 'dani@rial-ai.com',
            name: 'Dani',
            link: null,
            isGuildMember: false,
            hasTriagerRole: false,
          },
        ]}
      />,
    );

    expect(
      screen.getByRole('link', { name: 'Vincular mi Discord' }),
    ).toHaveAttribute('href', '/api/discord/oauth');
  });
});
