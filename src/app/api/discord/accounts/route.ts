import { getAuthenticatedUser } from '@/lib/auth';
import { listDiscordLinkedUsers } from '@/lib/discord/accounts';
import { apiError } from '@/lib/http';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) return Response.json({ error: 'No autenticado' }, { status: 401 });

  try {
    return Response.json({ data: await listDiscordLinkedUsers() });
  } catch (error) {
    return apiError(error);
  }
}
