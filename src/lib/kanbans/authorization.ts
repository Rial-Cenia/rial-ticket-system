import 'server-only';
import type { AuthenticatedUser } from '@/lib/auth';
import { HttpError } from '@/lib/http';
import { createAdminClient } from '@/lib/supabase/admin';

export function requireAdmin(user: AuthenticatedUser) {
  if (user.role !== 'ADMIN')
    throw new HttpError('No tienes permisos para realizar esta acción', 403);
}

export async function getLeaderTeamIds(user: AuthenticatedUser) {
  if (user.role === 'ADMIN') return null;
  const { data, error } = await createAdminClient()
    .from('TeamMembership')
    .select('teamId')
    .eq('userId', user.id)
    .eq('role', 'LEADER')
    .eq('status', 'ACTIVE');
  if (error) throw new Error(error.message);
  return (data ?? []).map((membership) => membership.teamId as string);
}

export async function requireLeader(user: AuthenticatedUser) {
  const teamIds = await getLeaderTeamIds(user);
  if (teamIds !== null && teamIds.length === 0)
    throw new HttpError(
      'No tienes permisos para gestionar equipos o kanbans',
      403,
    );
  return teamIds;
}

export async function requireTeamManager(
  user: AuthenticatedUser,
  teamId: string,
) {
  if (user.role === 'ADMIN') return;
  const { data, error } = await createAdminClient()
    .from('TeamMembership')
    .select('id')
    .eq('teamId', teamId)
    .eq('userId', user.id)
    .eq('role', 'LEADER')
    .eq('status', 'ACTIVE')
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data)
    throw new HttpError('No tienes permisos para gestionar este equipo', 403);
}

async function getKanbanTeamIds(kanbanId: string) {
  const { data, error } = await createAdminClient()
    .from('KanbanTeam')
    .select('teamId')
    .eq('kanbanId', kanbanId)
    .eq('status', 'ACTIVE');
  if (error) throw new Error(error.message);
  if (!data?.length) throw new HttpError('Kanban no encontrado', 404);
  return data.map((association) => association.teamId as string);
}

export async function requireKanbanMember(
  user: AuthenticatedUser,
  kanbanId: string,
) {
  if (user.role === 'ADMIN') return;
  const teamIds = await getKanbanTeamIds(kanbanId);
  const { data, error } = await createAdminClient()
    .from('TeamMembership')
    .select('id')
    .in('teamId', teamIds)
    .eq('userId', user.id)
    .eq('status', 'ACTIVE')
    .limit(1);
  if (error) throw new Error(error.message);
  if (!data?.length) throw new HttpError('No tienes acceso a este kanban', 403);
}

export async function requireKanbanManager(
  user: AuthenticatedUser,
  kanbanId: string,
) {
  if (user.role === 'ADMIN') return;
  const teamIds = await getKanbanTeamIds(kanbanId);
  const { data, error } = await createAdminClient()
    .from('TeamMembership')
    .select('id')
    .in('teamId', teamIds)
    .eq('userId', user.id)
    .eq('role', 'LEADER')
    .eq('status', 'ACTIVE')
    .limit(1);
  if (error) throw new Error(error.message);
  if (!data?.length)
    throw new HttpError('No tienes permisos para gestionar este kanban', 403);
}
