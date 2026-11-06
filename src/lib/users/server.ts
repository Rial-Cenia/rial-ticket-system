import 'server-only';
import type { AuthenticatedUser } from '@/lib/auth';
import { HttpError } from '@/lib/http';
import { requireAdmin, requireLeader } from '@/lib/kanbans/authorization';
import { createAdminClient } from '@/lib/supabase/admin';
import type { AccountStatus, AppRole, AppUser } from '@/lib/types';

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
    admin.from('AppUser').select('userId, role, status'),
  ]);
  if (authError) throw authError;
  if (rolesError) throw new Error(rolesError.message);
  const rolesByUserId = new Map(
    (roles ?? []).map((entry) => [
      entry.userId as string,
      {
        role: entry.role as AppRole,
        status: (entry.status === 'DISABLED'
          ? 'DISABLED'
          : 'ACTIVE') as AccountStatus,
      },
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
      role: rolesByUserId.get(user.id)?.role ?? 'USER',
      status: rolesByUserId.get(user.id)?.status ?? 'ACTIVE',
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

export async function updateAppUserStatus(
  actor: AuthenticatedUser,
  userId: string,
  status: AccountStatus,
) {
  requireAdmin(actor);
  if (actor.id === userId && status === 'DISABLED')
    throw new HttpError('No puedes deshabilitar tu propia cuenta', 400);

  const admin = createAdminClient();
  const { data: target, error: targetError } = await admin
    .from('AppUser')
    .select('userId, role, status')
    .eq('userId', userId)
    .maybeSingle();
  if (targetError) throw new Error(targetError.message);
  if (!target) throw new HttpError('Usuario no encontrado', 404);

  if (
    status === 'DISABLED' &&
    target.role === 'ADMIN' &&
    target.status === 'ACTIVE'
  ) {
    const { data: admins, error: adminsError } = await admin
      .from('AppUser')
      .select('userId')
      .eq('role', 'ADMIN')
      .eq('status', 'ACTIVE');
    if (adminsError) throw new Error(adminsError.message);
    if ((admins ?? []).length <= 1)
      throw new HttpError('Debe quedar al menos un administrador activo', 400);
  }

  const patch =
    status === 'DISABLED'
      ? {
          status,
          disabledAt: new Date().toISOString(),
          disabledByUserId: actor.id,
        }
      : { status, disabledAt: null, disabledByUserId: null };
  const { error } = await admin
    .from('AppUser')
    .update(patch)
    .eq('userId', userId);
  if (error) throw new Error(error.message);
  return { userId, status };
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
