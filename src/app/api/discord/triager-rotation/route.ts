import { getAuthenticatedUser } from '@/lib/auth';
import { apiError, HttpError } from '@/lib/http';
import { getServerEnv } from '@/lib/env/server';
import {
  getTriagerRotation,
  saveTriagerRotation,
  sendWeeklyTriagerReminder,
} from '@/lib/discord/triager-rotation';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const rotationSchema = z.object({
  enabled: z.boolean(),
  startsOn: z.iso.date(),
  memberUserIds: z.array(z.string().uuid()).max(100),
});

export async function GET() {
  try {
    const user = await getAuthenticatedUser();
    if (!user) throw new HttpError('No autenticado', 401);
    return Response.json({ data: await getTriagerRotation() });
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) throw new HttpError('No autenticado', 401);
    const input = rotationSchema.parse(await request.json());
    await saveTriagerRotation(user, input);
    return Response.json({ data: await getTriagerRotation() });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  const { CRON_SECRET } = getServerEnv();
  if (
    !CRON_SECRET ||
    request.headers.get('authorization') !== `Bearer ${CRON_SECRET}`
  )
    return Response.json({ error: 'No autorizado' }, { status: 401 });
  try {
    return Response.json({ data: await sendWeeklyTriagerReminder() });
  } catch (error) {
    return apiError(error);
  }
}
