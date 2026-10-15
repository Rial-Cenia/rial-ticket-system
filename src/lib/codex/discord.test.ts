// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  acknowledge: vi.fn(),
  followup: vi.fn(),
  rpc: vi.fn(),
  env: vi.fn(),
  ticket: vi.fn(),
  latest: vi.fn(),
  request: vi.fn(),
  cancel: vi.fn(),
}));

vi.mock('@/lib/discord/client', () => ({
  callbackInteraction: mocks.acknowledge,
  followupInteraction: mocks.followup,
}));
vi.mock('@/lib/env/server', () => ({ getBotukiEnv: mocks.env }));
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ rpc: mocks.rpc }),
}));
vi.mock('@/lib/tickets/server', () => ({
  getTicketByDiscordThreadId: mocks.ticket,
}));
vi.mock('@/lib/codex/server', () => ({
  getLatestCodexRun: mocks.latest,
  requestCodexAnalysis: mocks.request,
  cancelCodexRun: mocks.cancel,
}));

import { handleCodexCommand } from '@/lib/codex/discord';

const interaction = {
  id: 'interaction-1',
  application_id: 'app-1',
  token: 'token-1',
  type: 2,
  channel_id: 'thread-1',
  member: {
    roles: ['operator-role'],
    user: { id: 'user-1', username: 'operator' },
  },
};

describe('Botuki Discord commands', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.env.mockReturnValue({ operatorRoleId: 'operator-role' });
    mocks.rpc.mockResolvedValue({ data: true, error: null });
    mocks.ticket.mockResolvedValue({
      publicId: 'ticket-1',
      title: 'Small bug',
    });
    mocks.latest.mockResolvedValue(null);
    mocks.acknowledge.mockResolvedValue(undefined);
    mocks.followup.mockResolvedValue(undefined);
  });

  it('rejects users without the operator role', async () => {
    const response = await handleCodexCommand(
      { ...interaction, member: { ...interaction.member, roles: [] } } as never,
      'analyze',
    );
    expect(response.status).toBe(200);
    expect(mocks.acknowledge).not.toHaveBeenCalled();
    expect(mocks.ticket).not.toHaveBeenCalled();
  });

  it('starts analysis only inside a ticket thread', async () => {
    const response = await handleCodexCommand(interaction as never, 'analyze');
    expect(response.status).toBe(202);
    expect(mocks.request).toHaveBeenCalledWith(
      expect.objectContaining({ publicId: 'ticket-1' }),
      'user-1',
    );
    expect(mocks.acknowledge).toHaveBeenCalledOnce();
  });

  it('keeps implementation behind the analysis gate', async () => {
    const response = await handleCodexCommand(
      interaction as never,
      'implement',
    );
    await expect(response.json()).resolves.toMatchObject({
      data: { content: expect.stringContaining('LOW elegible') },
    });
    expect(mocks.acknowledge).not.toHaveBeenCalled();
    expect(mocks.request).not.toHaveBeenCalled();
  });
});
