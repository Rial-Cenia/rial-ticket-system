import { requireApiUser } from '@/lib/api/auth';
import { apiError } from '@/lib/http';
import { createTeamSchema } from '@/lib/schemas';
import { createTeam, listTeams } from '@/lib/teams/server';

export async function GET() {
  try {
    const actor = await requireApiUser();
    return Response.json({ data: await listTeams(actor) });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireApiUser();
    const { name } = createTeamSchema.parse(await request.json());
    return Response.json(
      { data: await createTeam(actor, name) },
      { status: 201 },
    );
  } catch (error) {
    return apiError(error);
  }
}
