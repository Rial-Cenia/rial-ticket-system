import { requireApiUser } from '@/lib/api/auth';
import { apiError } from '@/lib/http';
import {
  listKanbanGithubRepositories,
  updateKanbanGithubRepositories,
} from '@/lib/github/server';
import { z } from 'zod';

const inputSchema = z.object({ repositoryIds: z.array(z.string().uuid()) });

export async function GET(
  _: Request,
  context: { params: Promise<{ kanbanId: string }> },
) {
  try {
    const actor = await requireApiUser();
    const { kanbanId } = await context.params;
    return Response.json({
      data: await listKanbanGithubRepositories(actor, kanbanId),
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ kanbanId: string }> },
) {
  try {
    const actor = await requireApiUser();
    const { kanbanId } = await context.params;
    const input = inputSchema.parse(await request.json());
    return Response.json({
      data: await updateKanbanGithubRepositories(
        actor,
        kanbanId,
        input.repositoryIds,
      ),
    });
  } catch (error) {
    return apiError(error);
  }
}
