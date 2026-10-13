import { requireApiUser } from '@/lib/api/auth';
import { apiError } from '@/lib/http';
import {
  createKanbanCardComment,
  listKanbanCardComments,
} from '@/lib/kanbans/comments';
import { createKanbanCardCommentSchema } from '@/lib/schemas';

type Context = { params: Promise<{ kanbanId: string; cardId: string }> };

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, context: Context) {
  try {
    const actor = await requireApiUser();
    const { kanbanId, cardId } = await context.params;
    return Response.json({
      data: await listKanbanCardComments(actor, kanbanId, cardId),
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request, context: Context) {
  try {
    const actor = await requireApiUser();
    const { kanbanId, cardId } = await context.params;
    const formData = await request.formData();
    const input = createKanbanCardCommentSchema.parse({
      content: formData.get('content') ?? '',
    });
    const attachments = formData
      .getAll('attachments')
      .filter((value): value is File => typeof value !== 'string');
    return Response.json(
      {
        data: await createKanbanCardComment(
          actor,
          kanbanId,
          cardId,
          input.content,
          attachments,
        ),
      },
      { status: 201 },
    );
  } catch (error) {
    return apiError(error);
  }
}
