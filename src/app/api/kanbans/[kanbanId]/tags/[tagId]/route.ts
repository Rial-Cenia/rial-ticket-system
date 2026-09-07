import { requireApiUser } from '@/lib/api/auth';
import { apiError } from '@/lib/http';
import { cancelKanbanTag, updateKanbanTag } from '@/lib/kanbans/server';
import { updateKanbanTagSchema } from '@/lib/schemas';

type Context = { params: Promise<{ kanbanId: string; tagId: string }> };

export async function PATCH(request: Request, context: Context) {
  try {
    const actor = await requireApiUser();
    const { kanbanId, tagId } = await context.params;
    const { name } = updateKanbanTagSchema.parse(await request.json());
    return Response.json({
      data: await updateKanbanTag(actor, kanbanId, tagId, name),
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(_: Request, context: Context) {
  try {
    const actor = await requireApiUser();
    const { kanbanId, tagId } = await context.params;
    return Response.json({
      data: await cancelKanbanTag(actor, kanbanId, tagId),
    });
  } catch (error) {
    return apiError(error);
  }
}
