import { requireApiUser } from '@/lib/api/auth';
import { apiError } from '@/lib/http';
import { createKanbanTag } from '@/lib/kanbans/server';
import { createKanbanTagSchema } from '@/lib/schemas';

export async function POST(
  request: Request,
  context: { params: Promise<{ kanbanId: string }> },
) {
  try {
    const actor = await requireApiUser();
    const { kanbanId } = await context.params;
    const { name } = createKanbanTagSchema.parse(await request.json());
    return Response.json(
      { data: await createKanbanTag(actor, kanbanId, name) },
      { status: 201 },
    );
  } catch (error) {
    return apiError(error);
  }
}
