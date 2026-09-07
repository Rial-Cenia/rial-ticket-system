import { requireApiUser } from '@/lib/api/auth';
import { apiError } from '@/lib/http';
import { createKanbanCard } from '@/lib/kanbans/server';
import { createKanbanCardSchema } from '@/lib/schemas';

export async function POST(
  request: Request,
  context: { params: Promise<{ kanbanId: string }> },
) {
  try {
    const actor = await requireApiUser();
    const { kanbanId } = await context.params;
    const input = createKanbanCardSchema.parse(await request.json());
    return Response.json(
      { data: await createKanbanCard(actor, kanbanId, input) },
      { status: 201 },
    );
  } catch (error) {
    return apiError(error);
  }
}
