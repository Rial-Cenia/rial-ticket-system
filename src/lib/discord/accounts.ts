import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  addGuildMemberRole,
  getGuildMember,
  removeGuildMemberRole,
} from '@/lib/discord/client';
import { getDiscordEnv } from '@/lib/env/server';
import type { DiscordAccountLink, DiscordLinkedUser } from '@/lib/types';
import type { DiscordGuildMember, DiscordUser } from '@/lib/discord/types';

export async function linkDiscordAccount(
  userId: string,
  discordUser: DiscordUser,
  member: DiscordGuildMember,
) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('DiscordAccountLink')
    .upsert(
      {
        userId,
        discordUserId: discordUser.id,
        discordUsername: discordUser.username,
        discordDisplayName: discordUser.global_name ?? null,
        discordAvatarHash: discordUser.avatar ?? null,
        guildNickname: member.nick ?? null,
      },
      { onConflict: 'userId' },
    )
    .select('*')
    .single();
  if (error) {
    if (error.code === '23505')
      throw new Error(
        'Esta cuenta de Discord ya está vinculada a otro usuario',
      );
    throw error;
  }
  return data as DiscordAccountLink;
}

export async function unlinkDiscordAccount(userId: string) {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from('DiscordAccountLink')
    .delete()
    .eq('userId', userId);
  if (error) throw error;
}

export async function getDiscordAccountLink(userId: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('DiscordAccountLink')
    .select('*')
    .eq('userId', userId)
    .maybeSingle();
  if (error) throw error;
  return data as DiscordAccountLink | null;
}

export async function listDiscordLinkedUsers(): Promise<DiscordLinkedUser[]> {
  const supabase = createAdminClient();
  const [
    { data: authData, error: authError },
    { data: links, error: linksError },
  ] = await Promise.all([
    supabase.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    supabase.from('DiscordAccountLink').select('*'),
  ]);
  if (authError) throw authError;
  if (linksError) throw linksError;

  const linksByUserId = new Map(
    (links as DiscordAccountLink[]).map((link) => [link.userId, link]),
  );
  const { triagerRoleId } = getDiscordEnv();

  return Promise.all(
    authData.users.map(async (user) => {
      const link = linksByUserId.get(user.id) ?? null;
      const member = link ? await getGuildMember(link.discordUserId) : null;
      const name =
        typeof user.user_metadata?.full_name === 'string'
          ? user.user_metadata.full_name
          : (user.email ?? user.id);
      return {
        userId: user.id,
        email: user.email ?? '',
        name,
        link,
        isGuildMember: member !== null,
        hasTriagerRole: member?.roles.includes(triagerRoleId) ?? false,
      };
    }),
  );
}

export async function setTriagerRole(
  userId: string,
  enabled: boolean,
  actorName: string,
) {
  const link = await getDiscordAccountLink(userId);
  if (!link)
    throw new Error('El usuario no tiene una cuenta Discord vinculada');

  const member = await getGuildMember(link.discordUserId);
  if (!member)
    throw new Error('El usuario ya no pertenece al servidor de Discord');

  const { triagerRoleId } = getDiscordEnv();
  const hasRole = member.roles.includes(triagerRoleId);
  if (enabled && !hasRole)
    await addGuildMemberRole(link.discordUserId, triagerRoleId, actorName);
  if (!enabled && hasRole)
    await removeGuildMemberRole(link.discordUserId, triagerRoleId, actorName);

  return { enabled };
}
