import { getAuthenticatedUser } from '@/lib/auth';
import { unlinkDiscordAccount } from '@/lib/discord/accounts';
import { apiError } from '@/lib/http';

export async function DELETE() {
  const user = await getAuthenticatedUser();
  if (!user) return Response.json({ error: 'No autenticado' }, { status: 401 });

  try {
    await unlinkDiscordAccount(user.id);
    return new Response(null, { status: 204 });
  } catch (error) {
    return apiError(error);
  }
}
