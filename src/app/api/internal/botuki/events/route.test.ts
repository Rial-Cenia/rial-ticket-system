// @vitest-environment node
import { createHmac } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  getTicket: vi.fn(),
  insertEvent: vi.fn(),
  insertOutbox: vi.fn(),
  processOutboxJobs: vi.fn(),
}));

vi.mock('@/lib/discord/jobs', () => ({
  processOutboxJobs: mocks.processOutboxJobs,
}));
vi.mock('@/lib/env/server', () => ({
  getBotukiEnv: () => ({ runnerSharedSecret: 'shared-secret' }),
}));
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ from: mocks.from }),
}));
vi.mock('@/lib/tickets/server', () => ({ getTicket: mocks.getTicket }));

import { POST } from '@/app/api/internal/botuki/events/route';

const runId = '3d7b8cb4-4eaf-4d9a-ae97-1c3c807d8c71';
const ticketPublicId = '4d8c9db5-5fb0-4eab-9bf8-2d8d918ee782';

function signedRequest(payload: object) {
  const body = JSON.stringify(payload);
  const signature = createHmac('sha256', 'shared-secret')
    .update(body)
    .digest('hex');
  return new Request('http://localhost/api/internal/botuki/events', {
    method: 'POST',
    body,
    headers: { 'x-botuki-event-signature': `sha256=${signature}` },
  });
}

describe('POST /api/internal/botuki/events', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getTicket.mockResolvedValue({
      publicId: ticketPublicId,
      id: 98,
      discordThreadId: 'thread-1',
    });
    mocks.processOutboxJobs.mockResolvedValue({ delivered: 1 });
    mocks.insertOutbox.mockResolvedValue({ error: null });
    mocks.insertEvent.mockResolvedValue({ error: null });
    mocks.from.mockImplementation((table: string) => {
      if (table === 'CodexRun')
        return {
          select: () => ({
            eq: () => ({
              single: () =>
                Promise.resolve({
                  data: {
                    ticketPublicId,
                    pullRequestUrl:
                      'https://github.com/Rial-Cenia/rial-frontend/pull/385',
                    repositoryFullName: 'Rial-Cenia/rial-frontend',
                  },
                  error: null,
                }),
            }),
          }),
        };
      if (table === 'CodexRunEvent')
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                limit: () => Promise.resolve({ data: [], error: null }),
              }),
            }),
          }),
          insert: mocks.insertEvent,
        };
      if (table === 'CodexRunUsage')
        return {
          select: () => ({
            eq: () =>
              Promise.resolve({
                data: [
                  {
                    phase: 'ANALYSIS',
                    inputTokens: 2205,
                    cachedInputTokens: 0,
                    outputTokens: 1360,
                  },
                  {
                    phase: 'IMPLEMENTATION',
                    inputTokens: 507463,
                    cachedInputTokens: 467456,
                    outputTokens: 5797,
                  },
                ],
                error: null,
              }),
          }),
        };
      if (table === 'TicketSyncOutbox') return { insert: mocks.insertOutbox };
      throw new Error(`Unexpected table: ${table}`);
    });
  });

  it('encola la notificación de PR para la plataforma asignada', async () => {
    const response = await POST(signedRequest({ runId, event: 'PR_OPENED' }));

    expect(response.status).toBe(200);
    expect(mocks.insertOutbox).toHaveBeenCalledWith({
      ticketPublicId,
      type: 'SEND_THREAD_MESSAGE',
      payload: expect.objectContaining({
        threadId: 'thread-1',
        notifyPlatform: true,
        content: expect.stringContaining(
          'Costo estimado de ejecución: **US$0.24**',
        ),
      }),
    });
  });
});
