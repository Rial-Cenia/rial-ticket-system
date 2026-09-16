// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ rpc: mocks.rpc }),
}));

import { getTicketMetrics } from '@/lib/metrics/server';

describe('getTicketMetrics', () => {
  afterEach(() => vi.clearAllMocks());

  it('envía los filtros al RPC de agregación', async () => {
    const data = { summary: { openHighToday: 2 } };
    mocks.rpc.mockResolvedValue({ data, error: null });

    await expect(
      getTicketMetrics({
        rangeDays: 7,
        platform: 'ATOM',
        staleDays: 5,
        unassignedHours: 8,
      }),
    ).resolves.toBe(data);

    expect(mocks.rpc).toHaveBeenCalledWith('get_ticket_metrics', {
      p_days: 7,
      p_platform: 'ATOM',
      p_stale_days: 5,
      p_unassigned_hours: 8,
    });
  });

  it('propaga errores del RPC', async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { message: 'Database unavailable' },
    });

    await expect(
      getTicketMetrics({
        rangeDays: 30,
        staleDays: 3,
        unassignedHours: 4,
      }),
    ).rejects.toThrow('Database unavailable');
  });
});
