import { requireApiUser } from '@/lib/api/auth';
import { getGuildRoles } from '@/lib/discord/client';
import { apiError } from '@/lib/http';

export async function GET() {
  try {
    await requireApiUser();
    return Response.json({ data: await getGuildRoles() });
  } catch (error) {
    return apiError(error);
  }
}
