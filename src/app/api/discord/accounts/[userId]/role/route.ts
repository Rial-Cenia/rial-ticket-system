import { getAuthenticatedUser } from '@/lib/auth';
import { setTriagerRole } from '@/lib/discord/accounts';
import { apiError } from '@/lib/http';
import { discordRoleUpdateSchema } from '@/lib/schemas';

interface Context {
  params: Promise<{ userId: string }>;
}

export async function PATCH(request: Request, context: Context) {
  const user = await getAuthenticatedUser();
  if (!user) return Response.json({ error: 'No autenticado' }, { status: 401 });

  try {
    const { userId } = await context.params;
    const { enabled } = discordRoleUpdateSchema.parse(await request.json());
    return Response.json({
      data: await setTriagerRole(userId, enabled, user.name),
    });
  } catch (error) {
    return apiError(error);
  }
}
