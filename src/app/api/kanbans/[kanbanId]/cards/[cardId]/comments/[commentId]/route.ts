import { requireApiUser } from '@/lib/api/auth';
import { apiError } from '@/lib/http';
import { deleteKanbanCardComment } from '@/lib/kanbans/comments';

type Context = {
  params: Promise<{ kanbanId: string; cardId: string; commentId: string }>;
};

export async function DELETE(_request: Request, context: Context) {
  try {
    const actor = await requireApiUser();
    const { kanbanId, cardId, commentId } = await context.params;
    return Response.json({
      data: await deleteKanbanCardComment(actor, kanbanId, cardId, commentId),
    });
  } catch (error) {
    return apiError(error);
  }
}
