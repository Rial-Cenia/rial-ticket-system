import { getAuthenticatedUser } from '@/lib/auth';
import { apiError } from '@/lib/http';
import { getTicketMetrics } from '@/lib/metrics/server';
import { METRICS_DEFAULTS } from '@/lib/metrics/constants';
import { platformSchema } from '@/lib/schemas';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const metricsQuerySchema = z.object({
  rangeDays: z.coerce
    .number()
    .int()
    .min(1)
    .max(90)
    .default(METRICS_DEFAULTS.rangeDays),
  platform: platformSchema.optional(),
  staleDays: z.coerce
    .number()
    .int()
    .min(1)
    .max(30)
    .default(METRICS_DEFAULTS.staleDays),
  unassignedHours: z.coerce
    .number()
    .int()
    .min(1)
    .max(168)
    .default(METRICS_DEFAULTS.unassignedHours),
});

export async function GET(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user) return Response.json({ error: 'No autenticado' }, { status: 401 });
  try {
    const query = metricsQuerySchema.parse(
      Object.fromEntries(new URL(request.url).searchParams.entries()),
    );
    return Response.json({ data: await getTicketMetrics(query) });
  } catch (error) {
    return apiError(error);
  }
}
