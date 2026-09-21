import { requireApiUser } from '@/lib/api/auth';
import { apiError } from '@/lib/http';
import { cancelKanbanConnection } from '@/lib/kanbans/server';

type Context = { params: Promise<{ kanbanId: string; connectionId: string }> };

export async function DELETE(_: Request, context: Context) {
  try {
    const actor = await requireApiUser();
    const { kanbanId, connectionId } = await context.params;
    return Response.json({
      data: await cancelKanbanConnection(actor, kanbanId, connectionId),
    });
  } catch (error) {
    return apiError(error);
  }
}
