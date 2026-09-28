import { requireApiUser } from '@/lib/api/auth';
import { apiError } from '@/lib/http';
import { unlinkGithubRepositoryFromTeam } from '@/lib/github/server';

export async function DELETE(
  _: Request,
  context: { params: Promise<{ teamId: string; repositoryId: string }> },
) {
  try {
    const actor = await requireApiUser();
    const { teamId, repositoryId } = await context.params;
    return Response.json({
      data: await unlinkGithubRepositoryFromTeam(actor, teamId, repositoryId),
    });
  } catch (error) {
    return apiError(error);
  }
}
