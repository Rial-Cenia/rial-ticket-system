import { requireApiUser } from '@/lib/api/auth';
import { apiError } from '@/lib/http';
import { listGithubRepositories } from '@/lib/github/server';

export async function GET() {
  try {
    const actor = await requireApiUser();
    return Response.json({ data: await listGithubRepositories(actor) });
  } catch (error) {
    return apiError(error);
  }
}
