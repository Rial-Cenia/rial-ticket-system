import { requireApiUser } from '@/lib/api/auth';
import { apiError } from '@/lib/http';
import { getDefaultTicketFilters } from '@/lib/ticket-scope/server';

export async function GET() {
  try {
    const actor = await requireApiUser();
    return Response.json({ data: await getDefaultTicketFilters(actor) });
  } catch (error) {
    return apiError(error);
  }
}
