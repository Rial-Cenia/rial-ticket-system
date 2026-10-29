import { requireApiUser } from '@/lib/api/auth';
import { apiError } from '@/lib/http';
import { createProjectSchema } from '@/lib/schemas';
import { createProject, listProjects } from '@/lib/projects/server';

export async function GET() {
  try {
    await requireApiUser();
    return Response.json({ data: await listProjects() });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireApiUser();
    const input = createProjectSchema.parse(await request.json());
    return Response.json(
      { data: await createProject(actor, input) },
      { status: 201 },
    );
  } catch (error) {
    return apiError(error);
  }
}
