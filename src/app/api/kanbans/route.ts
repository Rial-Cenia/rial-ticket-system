import { requireApiUser } from '@/lib/api/auth';
import { apiError } from '@/lib/http';
import { createKanban, listKanbans } from '@/lib/kanbans/server';
import { createKanbanSchema } from '@/lib/schemas';

export async function GET() {
  try {
    const actor = await requireApiUser();
    return Response.json({ data: await listKanbans(actor) });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireApiUser();
    const input = createKanbanSchema.parse(await request.json());
    return Response.json(
      { data: await createKanban(actor, input.name, input.teamIds) },
      { status: 201 },
    );
  } catch (error) {
    return apiError(error);
  }
}
