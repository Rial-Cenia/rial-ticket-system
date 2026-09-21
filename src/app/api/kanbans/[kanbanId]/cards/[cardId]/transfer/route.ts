import { requireApiUser } from '@/lib/api/auth';
import { apiError } from '@/lib/http';
import { transferKanbanCard } from '@/lib/kanbans/server';
import { z } from 'zod';

const schema = z.object({ targetKanbanId: z.string().uuid() });

export async function POST(
  request: Request,
  context: { params: Promise<{ kanbanId: string; cardId: string }> },
) {
  try {
    const actor = await requireApiUser();
    const { kanbanId, cardId } = await context.params;
    const { targetKanbanId } = schema.parse(await request.json());
    return Response.json({
      data: await transferKanbanCard(actor, kanbanId, cardId, targetKanbanId),
    });
  } catch (error) {
    return apiError(error);
  }
}
