import { requireApiUser } from '@/lib/api/auth';
import { apiError } from '@/lib/http';
import { updateAccountStatusSchema } from '@/lib/schemas';
import { updateAppUserStatus } from '@/lib/users/server';

export async function PATCH(
  request: Request,
  context: { params: Promise<{ userId: string }> },
) {
  try {
    const actor = await requireApiUser();
    const { userId } = await context.params;
    const { status } = updateAccountStatusSchema.parse(await request.json());
    return Response.json({
      data: await updateAppUserStatus(actor, userId, status),
    });
  } catch (error) {
    return apiError(error);
  }
}
