import 'server-only';
import type { AuthenticatedUser } from '@/lib/auth';
import { requireAdmin, requireLeader } from '@/lib/kanbans/authorization';
import { createAdminClient } from '@/lib/supabase/admin';
import type { AppRole, AppUser } from '@/lib/types';

export async function listAppUsers(
  actor: AuthenticatedUser,
): Promise<AppUser[]> {
  await requireLeader(actor);
  return listUserDirectory();
}

export async function listUserDirectory(): Promise<AppUser[]> {
  const admin = createAdminClient();
  const [
    { data: authData, error: authError },
    { data: roles, error: rolesError },
  ] = await Promise.all([
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    admin.from('AppUser').select('userId, role'),
  ]);
  if (authError) throw authError;
  if (rolesError) throw new Error(rolesError.message);
  const rolesByUserId = new Map(
    (roles ?? []).map((entry) => [
      entry.userId as string,
      entry.role as AppRole,
    ]),
  );
  return authData.users
    .filter((user) => user.email)
    .map((user) => ({
      userId: user.id,
      email: user.email ?? '',
      name:
        typeof user.user_metadata?.full_name === 'string'
          ? user.user_metadata.full_name
          : (user.email ?? user.id),
      role: rolesByUserId.get(user.id) ?? 'USER',
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

export async function updateAppUserRole(
  actor: AuthenticatedUser,
  userId: string,
  role: AppRole,
) {
  requireAdmin(actor);
  const { error } = await createAdminClient()
    .from('AppUser')
    .upsert({ userId, role }, { onConflict: 'userId' });
  if (error) throw new Error(error.message);
  return { userId, role };
}
