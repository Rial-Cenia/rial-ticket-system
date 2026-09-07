import { requireApiUser } from '@/lib/api/auth';
import { apiError } from '@/lib/http';
import { createKanbanState, reorderKanbanStates } from '@/lib/kanbans/server';
import {
  createKanbanStateSchema,
  reorderKanbanStatesSchema,
} from '@/lib/schemas';

type Context = { params: Promise<{ kanbanId: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const actor = await requireApiUser();
    const { kanbanId } = await context.params;
    const { name } = createKanbanStateSchema.parse(await request.json());
    return Response.json(
      { data: await createKanbanState(actor, kanbanId, name) },
      { status: 201 },
    );
  } catch (error) {
    return apiError(error);
  }
}

export async function PUT(request: Request, context: Context) {
  try {
    const actor = await requireApiUser();
    const { kanbanId } = await context.params;
    const { stateIds } = reorderKanbanStatesSchema.parse(await request.json());
    return Response.json({
      data: await reorderKanbanStates(actor, kanbanId, stateIds),
    });
  } catch (error) {
    return apiError(error);
  }
}
