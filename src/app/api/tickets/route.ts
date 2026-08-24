import { getAuthenticatedUser } from '@/lib/auth';
import { processOutboxJobs } from '@/lib/discord/jobs';
import { apiError } from '@/lib/http';
import { createTicketSchema, ticketFiltersSchema } from '@/lib/schemas';
import { createTicket, listTickets } from '@/lib/tickets/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user) return Response.json({ error: 'No autenticado' }, { status: 401 });

  try {
    const params = Object.fromEntries(
      new URL(request.url).searchParams.entries(),
    );
    const filters = ticketFiltersSchema.parse(params);
    return Response.json({ data: await listTickets(filters) });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user) return Response.json({ error: 'No autenticado' }, { status: 401 });

  try {
    const input = createTicketSchema.parse(await request.json());
    const ticket = await createTicket(input, 'WEB', {
      id: user.id,
      name: user.name,
    });
    await processOutboxJobs(5).catch(() => null);
    return Response.json({ data: ticket }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
