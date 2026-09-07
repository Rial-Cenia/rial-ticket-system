import { requireApiUser } from '@/lib/api/auth';
import { apiError } from '@/lib/http';
import { updateTeamSchema } from '@/lib/schemas';
import { cancelTeam, updateTeam } from '@/lib/teams/server';

type Context = { params: Promise<{ teamId: string }> };

export async function PATCH(request: Request, context: Context) {
  try {
    const actor = await requireApiUser();
    const { teamId } = await context.params;
    const { name } = updateTeamSchema.parse(await request.json());
    return Response.json({ data: await updateTeam(actor, teamId, name!) });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(_: Request, context: Context) {
  try {
    const actor = await requireApiUser();
    const { teamId } = await context.params;
    return Response.json({ data: await cancelTeam(actor, teamId) });
  } catch (error) {
    return apiError(error);
  }
}
