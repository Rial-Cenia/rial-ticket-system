import { requireApiUser } from '@/lib/api/auth';
import { apiError } from '@/lib/http';
import { updateProjectSchema } from '@/lib/schemas';
import { updateProject } from '@/lib/projects/server';

type Context = { params: Promise<{ projectId: string }> };

export async function PATCH(request: Request, context: Context) {
  try {
    await requireApiUser();
    const { projectId } = await context.params;
    const input = updateProjectSchema.parse(await request.json());
    return Response.json({ data: await updateProject(projectId, input) });
  } catch (error) {
    return apiError(error);
  }
}
