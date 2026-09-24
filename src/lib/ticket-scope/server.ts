import 'server-only';
import type { AuthenticatedUser } from '@/lib/auth';
import { requireAdmin } from '@/lib/kanbans/authorization';
import { getDiscordAccountLink } from '@/lib/discord/accounts';
import { getGuildMember } from '@/lib/discord/client';
import { getDiscordEnv } from '@/lib/env/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type {
  DiscordRoleConnection,
  Platform,
  TicketFilters,
  TeamPlatformConnection,
} from '@/lib/types';

interface ScopeInput {
  roleId: string;
  roleName: string;
  platform: Platform | null;
  teamId: string | null;
}

export async function listTeamPlatforms(): Promise<TeamPlatformConnection[]> {
  const { data, error } = await createAdminClient()
    .from('TeamPlatform')
    .select('id, teamId, platform, Team(name)')
    .eq('status', 'ACTIVE')
    .order('platform');
  if (error) throw new Error(error.message);
  return (data ?? []).flatMap((row) => {
    const team = row.Team as { name?: string } | null;
    return team?.name
      ? [
          {
            id: row.id as string,
            teamId: row.teamId as string,
            platform: row.platform as Platform,
            teamName: team.name,
          },
        ]
      : [];
  });
}

export async function saveTeamPlatform(
  actor: AuthenticatedUser,
  teamId: string,
  platform: Platform,
) {
  await requireAdmin(actor);
  const admin = createAdminClient();
  const { data: current, error: currentError } = await admin
    .from('TeamPlatform')
    .select('id')
    .eq('teamId', teamId)
    .eq('platform', platform)
    .maybeSingle();
  if (currentError) throw new Error(currentError.message);
  const { error } = current
    ? await admin
        .from('TeamPlatform')
        .update({ status: 'ACTIVE', createdByUserId: actor.id })
        .eq('id', current.id)
    : await admin.from('TeamPlatform').insert({
        teamId,
        platform,
        createdByUserId: actor.id,
        status: 'ACTIVE',
      });
  if (error) throw new Error(error.message);
}

export async function removeTeamPlatform(actor: AuthenticatedUser, id: string) {
  await requireAdmin(actor);
  const { error } = await createAdminClient()
    .from('TeamPlatform')
    .update({ status: 'CANCELLED' })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

export async function listDiscordRoleConnections(): Promise<
  DiscordRoleConnection[]
> {
  const { data, error } = await createAdminClient()
    .from('DiscordRoleConnection')
    .select('roleId, roleName, platform, teamId, Team(name)')
    .eq('status', 'ACTIVE')
    .order('roleName');
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    roleId: row.roleId as string,
    roleName: row.roleName as string,
    platform: row.platform as Platform | null,
    teamId: row.teamId as string | null,
    teamName: (row.Team as { name?: string } | null)?.name ?? null,
  }));
}

export async function saveDiscordRoleConnection(
  actor: AuthenticatedUser,
  input: ScopeInput,
) {
  await requireAdmin(actor);
  const { error } = await createAdminClient()
    .from('DiscordRoleConnection')
    .upsert(
      { ...input, createdByUserId: actor.id, status: 'ACTIVE' },
      { onConflict: 'roleId' },
    );
  if (error) throw new Error(error.message);
}

export async function removeDiscordRoleConnection(
  actor: AuthenticatedUser,
  roleId: string,
) {
  await requireAdmin(actor);
  const { error } = await createAdminClient()
    .from('DiscordRoleConnection')
    .update({ status: 'CANCELLED' })
    .eq('roleId', roleId);
  if (error) throw new Error(error.message);
}

export async function getDefaultTicketFilters(
  actor: AuthenticatedUser,
): Promise<TicketFilters> {
  const admin = createAdminClient();
  const [
    { data: memberships, error: membershipsError },
    teamPlatforms,
    roleConnections,
  ] = await Promise.all([
    admin
      .from('TeamMembership')
      .select('teamId')
      .eq('userId', actor.id)
      .eq('status', 'ACTIVE'),
    listTeamPlatforms(),
    listDiscordRoleConnections(),
  ]);
  if (membershipsError) throw new Error(membershipsError.message);

  const teamIds = new Set(
    (memberships ?? []).map((membership) => membership.teamId as string),
  );
  const platforms = new Set<Platform>();
  teamPlatforms
    .filter((connection) => teamIds.has(connection.teamId))
    .forEach((connection) => platforms.add(connection.platform));

  let roleIds: string[] = [];
  const link = await getDiscordAccountLink(actor.id);
  if (link) {
    const member = await getGuildMember(link.discordUserId);
    roleIds = member?.roles ?? [];
  }
  const env = getDiscordEnv();
  const fallbackPlatforms: Array<[Platform, string | null]> = [
    ['NESTOR', env.nestorRoleId],
    ['DYLAN', env.dylanRoleId],
    ['ATOM', env.atomRoleId],
    ['KAYS', env.kaysRoleId],
  ];
  fallbackPlatforms
    .filter(([, roleId]) => roleId !== null && roleIds.includes(roleId))
    .forEach(([platform]) => platforms.add(platform));
  roleConnections
    .filter((connection) => roleIds.includes(connection.roleId))
    .forEach((connection) => {
      if (connection.platform) platforms.add(connection.platform);
      if (connection.teamId)
        teamPlatforms
          .filter((item) => item.teamId === connection.teamId)
          .forEach((item) => platforms.add(item.platform));
    });

  const isTriager = roleIds.includes(env.triagerRoleId);
  if (isTriager) {
    const { count, error } = await admin
      .from('Ticket')
      .select('id', { count: 'exact', head: true })
      .is('platform', null)
      .neq('status', 'CANCELADO');
    if (error) throw new Error(error.message);
    if ((count ?? 0) > 0) return { platform: 'UNASSIGNED' };
  }
  return platforms.size ? { platforms: [...platforms] } : {};
}
