import { requireApiUser } from '@/lib/api/auth';
import { apiError } from '@/lib/http';
import { listAppUsers } from '@/lib/users/server';

export async function GET() {
  try {
    const user = await requireApiUser();
    return Response.json({ data: await listAppUsers(user) });
  } catch (error) {
    return apiError(error);
  }
}
