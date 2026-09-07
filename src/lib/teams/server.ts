import 'server-only';
import type { AuthenticatedUser } from '@/lib/auth';
import { HttpError } from '@/lib/http';
import { requireAdmin, requireTeamManager } from '@/lib/kanbans/authorization';
import { createAdminClient } from '@/lib/supabase/admin';
import { listUserDirectory } from '@/lib/users/server';
import type { Team, TeamMembershipRole } from '@/lib/types';

interface MembershipRow {
  id: string;
  teamId: string;
  userId: string;
  role: TeamMembershipRole;
}

export async function listTeams(actor: AuthenticatedUser): Promise<Team[]> {
  const admin = createAdminClient();
  const { data: memberships, error: membershipError } = await admin
    .from('TeamMembership')
    .select('id, teamId, userId, role')
    .eq('status', 'ACTIVE');
  if (membershipError) throw new Error(membershipError.message);
  const allMemberships = (memberships ?? []) as MembershipRow[];
  const visibleTeamIds = new Set(
    allMemberships
      .filter((membership) => membership.userId === actor.id)
      .map((membership) => membership.teamId),
  );

  let query = admin
    .from('Team')
    .select('id, name, createdAt, updatedAt')
    .eq('status', 'ACTIVE')
    .order('name');
  if (actor.role !== 'ADMIN') {
    if (!visibleTeamIds.size) return [];
    query = query.in('id', [...visibleTeamIds]);
  }
  const { data: teams, error: teamError } = await query;
  if (teamError) throw new Error(teamError.message);
  const users = await listUserDirectory();
  const usersById = new Map(users.map((user) => [user.userId, user]));

  return (teams ?? []).map((team) => {
    const teamMemberships = allMemberships.filter(
      (membership) => membership.teamId === team.id,
    );
    return {
      id: team.id as string,
      name: team.name as string,
      createdAt: team.createdAt as string,
      updatedAt: team.updatedAt as string,
      canManage:
        actor.role === 'ADMIN' ||
        teamMemberships.some(
          (membership) =>
            membership.userId === actor.id && membership.role === 'LEADER',
        ),
      members: teamMemberships.flatMap((membership) => {
        const user = usersById.get(membership.userId);
        return user
          ? [
              {
                ...user,
                membershipId: membership.id,
                membershipRole: membership.role,
              },
            ]
          : [];
      }),
    };
  });
}

export async function createTeam(actor: AuthenticatedUser, name: string) {
  requireAdmin(actor);
  const { data, error } = await createAdminClient()
    .from('Team')
    .insert({ name })
    .select('id, name, createdAt, updatedAt')
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateTeam(
  actor: AuthenticatedUser,
  teamId: string,
  name: string,
) {
  await requireTeamManager(actor, teamId);
  const { data, error } = await createAdminClient()
    .from('Team')
    .update({ name })
    .eq('id', teamId)
    .eq('status', 'ACTIVE')
    .select('id, name, createdAt, updatedAt')
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new HttpError('Equipo no encontrado', 404);
  return data;
}

export async function cancelTeam(actor: AuthenticatedUser, teamId: string) {
  await requireTeamManager(actor, teamId);
  const { error } = await createAdminClient().rpc('cancel_team', {
    p_team_id: teamId,
  });
  if (error) throw new Error(error.message);
  return { id: teamId, status: 'CANCELLED' as const };
}

export async function addTeamMember(
  actor: AuthenticatedUser,
  teamId: string,
  userId: string,
  role: TeamMembershipRole,
) {
  await requireTeamManager(actor, teamId);
  const { data, error } = await createAdminClient()
    .from('TeamMembership')
    .insert({ teamId, userId, role })
    .select('id, teamId, userId, role')
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateTeamMember(
  actor: AuthenticatedUser,
  teamId: string,
  membershipId: string,
  role: TeamMembershipRole,
) {
  await requireTeamManager(actor, teamId);
  const { data, error } = await createAdminClient()
    .from('TeamMembership')
    .update({ role })
    .eq('id', membershipId)
    .eq('teamId', teamId)
    .eq('status', 'ACTIVE')
    .select('id, teamId, userId, role')
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new HttpError('Membresía no encontrada', 404);
  return data;
}

export async function cancelTeamMember(
  actor: AuthenticatedUser,
  teamId: string,
  membershipId: string,
) {
  await requireTeamManager(actor, teamId);
  const { data, error } = await createAdminClient()
    .from('TeamMembership')
    .update({ status: 'CANCELLED' })
    .eq('id', membershipId)
    .eq('teamId', teamId)
    .eq('status', 'ACTIVE')
    .select('id')
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new HttpError('Membresía no encontrada', 404);
  return { id: membershipId, status: 'CANCELLED' as const };
}
