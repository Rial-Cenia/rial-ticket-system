import { requireApiUser } from '@/lib/api/auth';
import { apiError } from '@/lib/http';
import { cancelKanbanCard, updateKanbanCard } from '@/lib/kanbans/server';
import { updateKanbanCardSchema } from '@/lib/schemas';

type Context = { params: Promise<{ kanbanId: string; cardId: string }> };

export async function PATCH(request: Request, context: Context) {
  try {
    const actor = await requireApiUser();
    const { kanbanId, cardId } = await context.params;
    const input = updateKanbanCardSchema.parse(await request.json());
    return Response.json({
      data: await updateKanbanCard(actor, kanbanId, cardId, input),
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(_: Request, context: Context) {
  try {
    const actor = await requireApiUser();
    const { kanbanId, cardId } = await context.params;
    return Response.json({
      data: await cancelKanbanCard(actor, kanbanId, cardId),
    });
  } catch (error) {
    return apiError(error);
  }
}
