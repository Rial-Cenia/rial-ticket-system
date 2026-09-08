import { requireApiUser } from '@/lib/api/auth';
import { apiError } from '@/lib/http';
import { archiveFinalStateCards } from '@/lib/kanbans/server';

type Context = { params: Promise<{ kanbanId: string; stateId: string }> };

export async function POST(_: Request, context: Context) {
  try {
    const actor = await requireApiUser();
    const { kanbanId, stateId } = await context.params;
    return Response.json({
      data: await archiveFinalStateCards(actor, kanbanId, stateId),
    });
  } catch (error) {
    return apiError(error);
  }
}
