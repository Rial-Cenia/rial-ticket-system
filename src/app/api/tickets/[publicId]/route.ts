import { getAuthenticatedUser } from '@/lib/auth';
import { processOutboxJobs } from '@/lib/discord/jobs';
import { apiError } from '@/lib/http';
import { updateTicketSchema } from '@/lib/schemas';
import { deleteTicket, updateTicket } from '@/lib/tickets/server';

interface Context {
  params: Promise<{ publicId: string }>;
}

export async function PATCH(request: Request, context: Context) {
  const user = await getAuthenticatedUser();
  if (!user) return Response.json({ error: 'No autenticado' }, { status: 401 });

  try {
    const { publicId } = await context.params;
    const patch = updateTicketSchema.parse(await request.json());
    const ticket = await updateTicket(publicId, patch, 'WEB', {
      id: user.id,
      name: user.name,
    });
    await processOutboxJobs(5).catch(() => null);
    return Response.json({ data: ticket });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(_: Request, context: Context) {
  const user = await getAuthenticatedUser();
  if (!user) return Response.json({ error: 'No autenticado' }, { status: 401 });

  try {
    const { publicId } = await context.params;
    const ticket = await deleteTicket(publicId, {
      id: user.id,
      name: user.name,
    });
    await processOutboxJobs(5).catch(() => null);
    return Response.json({ data: ticket });
  } catch (error) {
    return apiError(error);
  }
}
