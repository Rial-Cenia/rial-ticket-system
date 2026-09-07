import 'server-only';
import { getAuthenticatedUser } from '@/lib/auth';
import { HttpError } from '@/lib/http';

export async function requireApiUser() {
  const user = await getAuthenticatedUser();
  if (!user) throw new HttpError('No autenticado', 401);
  return user;
}
