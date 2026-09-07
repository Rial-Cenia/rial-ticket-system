import { requireApiUser } from '@/lib/api/auth';
import { apiError } from '@/lib/http';
import { updateAppRoleSchema } from '@/lib/schemas';
import { updateAppUserRole } from '@/lib/users/server';

export async function PATCH(
  request: Request,
  context: { params: Promise<{ userId: string }> },
) {
  try {
    const actor = await requireApiUser();
    const { userId } = await context.params;
    const { role } = updateAppRoleSchema.parse(await request.json());
    return Response.json({
      data: await updateAppUserRole(actor, userId, role),
    });
  } catch (error) {
    return apiError(error);
  }
}
