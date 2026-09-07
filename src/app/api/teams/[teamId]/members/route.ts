import { requireApiUser } from '@/lib/api/auth';
import { apiError } from '@/lib/http';
import { teamMembershipSchema } from '@/lib/schemas';
import { addTeamMember } from '@/lib/teams/server';

export async function POST(
  request: Request,
  context: { params: Promise<{ teamId: string }> },
) {
  try {
    const actor = await requireApiUser();
    const { teamId } = await context.params;
    const input = teamMembershipSchema.parse(await request.json());
    return Response.json(
      { data: await addTeamMember(actor, teamId, input.userId, input.role) },
      { status: 201 },
    );
  } catch (error) {
    return apiError(error);
  }
}
