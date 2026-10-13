import { getAuthenticatedUser } from '@/lib/auth';
import { apiError } from '@/lib/http';
import { downloadKanbanCardCommentAttachment } from '@/lib/kanbans/comments';

type Context = {
  params: Promise<{
    kanbanId: string;
    cardId: string;
    commentId: string;
    attachmentId: string;
  }>;
};

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, context: Context) {
  const actor = await getAuthenticatedUser();
  if (!actor)
    return Response.json({ error: 'No autenticado' }, { status: 401 });
  try {
    const { kanbanId, cardId, commentId, attachmentId } = await context.params;
    const file = await downloadKanbanCardCommentAttachment(
      actor,
      kanbanId,
      cardId,
      commentId,
      attachmentId,
    );
    if (!file)
      return Response.json({ error: 'Adjunto no encontrado' }, { status: 404 });
    const disposition = file.mimeType.startsWith('image/')
      ? 'inline'
      : 'attachment';
    return new Response(file.data, {
      headers: {
        'content-type': file.mimeType,
        'content-disposition': `${disposition}; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
        'cache-control': 'private, max-age=300',
        'x-content-type-options': 'nosniff',
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
