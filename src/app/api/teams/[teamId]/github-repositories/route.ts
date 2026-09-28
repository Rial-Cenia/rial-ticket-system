import { requireApiUser } from '@/lib/api/auth';
import { apiError } from '@/lib/http';
import {
  linkGithubRepositoryToTeam,
  listTeamGithubRepositories,
} from '@/lib/github/server';
import { z } from 'zod';

const inputSchema = z.object({
  repositoryId: z.string().uuid(),
  kanbanIds: z.array(z.string().uuid()).default([]),
});

export async function GET(
  _: Request,
  context: { params: Promise<{ teamId: string }> },
) {
  try {
    const actor = await requireApiUser();
    const { teamId } = await context.params;
    return Response.json({
      data: await listTeamGithubRepositories(actor, teamId),
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ teamId: string }> },
) {
  try {
    const actor = await requireApiUser();
    const { teamId } = await context.params;
    const input = inputSchema.parse(await request.json());
    return Response.json({
      data: await linkGithubRepositoryToTeam(
        actor,
        teamId,
        input.repositoryId,
        input.kanbanIds,
      ),
    });
  } catch (error) {
    return apiError(error);
  }
}
