import { requireApiUser } from '@/lib/api/auth';
import { apiError } from '@/lib/http';
import { cancelKanban, updateKanban } from '@/lib/kanbans/server';
import { updateKanbanSchema } from '@/lib/schemas';

type Context = { params: Promise<{ kanbanId: string }> };

export async function PATCH(request: Request, context: Context) {
  try {
    const actor = await requireApiUser();
    const { kanbanId } = await context.params;
    const input = updateKanbanSchema.parse(await request.json());
    return Response.json({ data: await updateKanban(actor, kanbanId, input) });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(_: Request, context: Context) {
  try {
    const actor = await requireApiUser();
    const { kanbanId } = await context.params;
    return Response.json({ data: await cancelKanban(actor, kanbanId) });
  } catch (error) {
    return apiError(error);
  }
}
