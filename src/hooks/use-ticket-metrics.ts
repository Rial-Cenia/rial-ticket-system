'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchTicketMetrics } from '@/lib/api/metrics';
import type { Platform } from '@/lib/types';

export function useTicketMetrics(input: {
  rangeDays: number;
  platform?: Platform;
  staleDays: number;
  unassignedHours: number;
}) {
  return useQuery({
    queryKey: ['ticket-metrics', input],
    queryFn: () => fetchTicketMetrics(input),
    staleTime: 60_000,
  });
}
