import { requireApiUser } from '@/lib/api/auth';
import { apiError } from '@/lib/http';
import { updateTeamMembershipSchema } from '@/lib/schemas';
import { cancelTeamMember, updateTeamMember } from '@/lib/teams/server';

type Context = { params: Promise<{ teamId: string; membershipId: string }> };

export async function PATCH(request: Request, context: Context) {
  try {
    const actor = await requireApiUser();
    const { teamId, membershipId } = await context.params;
    const { role } = updateTeamMembershipSchema.parse(await request.json());
    return Response.json({
      data: await updateTeamMember(actor, teamId, membershipId, role),
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(_: Request, context: Context) {
  try {
    const actor = await requireApiUser();
    const { teamId, membershipId } = await context.params;
    return Response.json({
      data: await cancelTeamMember(actor, teamId, membershipId),
    });
  } catch (error) {
    return apiError(error);
  }
}
