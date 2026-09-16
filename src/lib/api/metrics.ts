import type { Platform } from '@/lib/types';
import type { TicketMetrics } from '@/lib/metrics/types';

export async function fetchTicketMetrics(input: {
  rangeDays: number;
  platform?: Platform;
  staleDays: number;
  unassignedHours: number;
}) {
  const params = new URLSearchParams();
  Object.entries(input).forEach(([key, value]) => {
    if (value !== undefined) params.set(key, String(value));
  });
  const response = await fetch(`/api/metrics/tickets?${params}`, {
    cache: 'no-store',
  });
  const body = (await response.json()) as {
    data?: TicketMetrics;
    error?: string;
  };
  if (!response.ok || !body.data)
    throw new Error(body.error ?? 'No fue posible cargar las métricas');
  return body.data;
}
