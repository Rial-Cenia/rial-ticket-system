import { requireApiUser } from '@/lib/api/auth';
import { apiError } from '@/lib/http';
import { createTicketKanbanCardSchema } from '@/lib/schemas';
import { createCardFromTicket } from '@/lib/tickets/server';

export async function POST(
  request: Request,
  context: { params: Promise<{ publicId: string }> },
) {
  try {
    const actor = await requireApiUser();
    const { publicId } = await context.params;
    const input = createTicketKanbanCardSchema.parse(await request.json());
    return Response.json(
      { data: await createCardFromTicket(actor, publicId, input) },
      { status: 201 },
    );
  } catch (error) {
    return apiError(error);
  }
}
