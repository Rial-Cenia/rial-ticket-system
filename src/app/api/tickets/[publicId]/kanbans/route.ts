import { requireApiUser } from '@/lib/api/auth';
import { apiError } from '@/lib/http';
import { associateTicketKanban, listTicketKanbans } from '@/lib/tickets/server';
import { z } from 'zod';

const schema = z.object({ kanbanId: z.string().uuid() });
type Context = { params: Promise<{ publicId: string }> };

export async function GET(_: Request, context: Context) {
  try {
    await requireApiUser();
    const { publicId } = await context.params;
    return Response.json({ data: await listTicketKanbans(publicId) });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request, context: Context) {
  try {
    const actor = await requireApiUser();
    const { publicId } = await context.params;
    const { kanbanId } = schema.parse(await request.json());
    return Response.json(
      { data: await associateTicketKanban(actor, publicId, kanbanId) },
      { status: 201 },
    );
  } catch (error) {
    return apiError(error);
  }
}
