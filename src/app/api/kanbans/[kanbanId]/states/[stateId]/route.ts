import { requireApiUser } from '@/lib/api/auth';
import { apiError } from '@/lib/http';
import { cancelKanbanState, updateKanbanState } from '@/lib/kanbans/server';
import { updateKanbanStateSchema } from '@/lib/schemas';

type Context = { params: Promise<{ kanbanId: string; stateId: string }> };

export async function PATCH(request: Request, context: Context) {
  try {
    const actor = await requireApiUser();
    const { kanbanId, stateId } = await context.params;
    const input = updateKanbanStateSchema.parse(await request.json());
    return Response.json({
      data: await updateKanbanState(actor, kanbanId, stateId, input),
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(_: Request, context: Context) {
  try {
    const actor = await requireApiUser();
    const { kanbanId, stateId } = await context.params;
    return Response.json({
      data: await cancelKanbanState(actor, kanbanId, stateId),
    });
  } catch (error) {
    return apiError(error);
  }
}
