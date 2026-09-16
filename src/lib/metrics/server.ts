import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import type { Platform } from '@/lib/types';
import type { TicketMetrics } from '@/lib/metrics/types';

export async function getTicketMetrics(input: {
  rangeDays: number;
  platform?: Platform;
  staleDays: number;
  unassignedHours: number;
}) {
  const { data, error } = await createAdminClient().rpc('get_ticket_metrics', {
    p_days: input.rangeDays,
    p_platform: input.platform ?? null,
    p_stale_days: input.staleDays,
    p_unassigned_hours: input.unassignedHours,
  });
  if (error) throw new Error(error.message);
  return data as TicketMetrics;
}
