import { requireApiUser } from '@/lib/api/auth';
import { apiError } from '@/lib/http';
import {
  createKanbanConnection,
  listKanbanConnections,
} from '@/lib/kanbans/server';
import { createKanbanConnectionSchema } from '@/lib/schemas';

type Context = { params: Promise<{ kanbanId: string }> };

export async function GET(_: Request, context: Context) {
  try {
    const actor = await requireApiUser();
    const { kanbanId } = await context.params;
    return Response.json({
      data: await listKanbanConnections(actor, kanbanId),
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request, context: Context) {
  try {
    const actor = await requireApiUser();
    const { kanbanId } = await context.params;
    const { targetKanbanId } = createKanbanConnectionSchema.parse(
      await request.json(),
    );
    return Response.json(
      { data: await createKanbanConnection(actor, kanbanId, targetKanbanId) },
      { status: 201 },
    );
  } catch (error) {
    return apiError(error);
  }
}
