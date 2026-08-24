import { processOutboxJobs } from '@/lib/discord/jobs';
import { getServerEnv } from '@/lib/env/server';
import { apiError } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const secret = getServerEnv().CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    return Response.json(await processOutboxJobs(20));
  } catch (error) {
    return apiError(error);
  }
}
