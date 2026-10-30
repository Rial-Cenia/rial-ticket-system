import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { getServerEnv } from '@/lib/env/server';
import { sendChannelMessage } from '@/lib/discord/client';
import { listUserDirectory } from '@/lib/users/server';
import type { AuthenticatedUser } from '@/lib/auth';
import { requireAdmin } from '@/lib/kanbans/authorization';
import { HttpError } from '@/lib/http';

import {
  getMonday,
  getRotationIndex,
  getSantiagoDateParts,
  isRotationReminderTime,
} from '@/lib/discord/triager-rotation-date';

export interface TriagerRotationMember {
  userId: string;
  name: string;
  discordUserId: string;
  discordName: string;
}

async function readMembers() {
  const admin = createAdminClient();
  const [
    { data: members, error: membersError },
    { data: links, error: linksError },
    users,
  ] = await Promise.all([
    admin
      .from('TriagerRotationMember')
      .select('userId, position')
      .order('position'),
    admin
      .from('DiscordAccountLink')
      .select(
        'userId, discordUserId, discordUsername, discordDisplayName, guildNickname',
      ),
    listUserDirectory(),
  ]);
  if (membersError) throw membersError;
  if (linksError) throw linksError;
  const linksByUser = new Map((links ?? []).map((link) => [link.userId, link]));
  const usersById = new Map(users.map((user) => [user.userId, user]));
  const ordered = (members ?? []).flatMap(({ userId }) => {
    const user = usersById.get(userId);
    const link = linksByUser.get(userId);
    if (!user || !link) return [];
    return [
      {
        userId,
        name: user.name,
        discordUserId: link.discordUserId as string,
        discordName: (link.guildNickname ||
          link.discordDisplayName ||
          link.discordUsername) as string,
      },
    ];
  });
  const available = users.flatMap((user) => {
    const link = linksByUser.get(user.userId);
    if (!link) return [];
    return [
      {
        userId: user.userId,
        name: user.name,
        discordUserId: link.discordUserId as string,
        discordName: (link.guildNickname ||
          link.discordDisplayName ||
          link.discordUsername) as string,
      },
    ];
  });
  return { ordered, available };
}

export async function getTriagerRotation(now = new Date()) {
  const admin = createAdminClient();
  const [{ data: settings, error }, { ordered, available }] = await Promise.all(
    [
      admin
        .from('TriagerRotation')
        .select('enabled, startsOn')
        .eq('id', true)
        .single(),
      readMembers(),
    ],
  );
  if (error) throw error;
  const dateParts = getSantiagoDateParts(now);
  const weekStartsOn = getMonday(
    `${dateParts.year}-${dateParts.month}-${dateParts.day}`,
  );
  const index = settings.enabled
    ? getRotationIndex(settings.startsOn, weekStartsOn, ordered.length)
    : -1;
  return {
    enabled: settings.enabled as boolean,
    startsOn: settings.startsOn as string,
    weekStartsOn,
    members: ordered,
    availableUsers: available,
    currentUserId: index < 0 ? null : (ordered[index]?.userId ?? null),
    nextUserId:
      index < 0 || ordered.length < 2
        ? null
        : ordered[(index + 1) % ordered.length].userId,
  };
}

export async function saveTriagerRotation(
  actor: AuthenticatedUser,
  input: { enabled: boolean; startsOn: string; memberUserIds: string[] },
) {
  requireAdmin(actor);
  if (input.enabled && !input.memberUserIds.length)
    throw new HttpError('Agrega al menos una persona a la rotación', 400);
  if (new Set(input.memberUserIds).size !== input.memberUserIds.length)
    throw new HttpError('La lista contiene personas repetidas', 400);
  if (getMonday(input.startsOn) !== input.startsOn)
    throw new HttpError('La fecha de inicio debe ser lunes', 400);

  const admin = createAdminClient();
  const { error } = await admin.rpc('save_triager_rotation', {
    p_enabled: input.enabled,
    p_starts_on: input.startsOn,
    p_member_user_ids: input.memberUserIds,
  });
  if (error) {
    if (
      error.message.includes('Agrega al menos') ||
      error.message.includes('repetidas') ||
      error.message.includes('lunes') ||
      error.message.includes('vincular')
    )
      throw new HttpError(error.message, 400);
    throw error;
  }
}

export async function sendWeeklyTriagerReminder(now = new Date()) {
  if (!isRotationReminderTime(now)) return { skipped: true };
  const rotation = await getTriagerRotation(now);
  if (!rotation.enabled || !rotation.members.length)
    return { skipped: true, reason: 'rotation-disabled' };
  if (!rotation.currentUserId)
    return { skipped: true, reason: 'rotation-not-started' };
  const currentIndex = rotation.members.findIndex(
    ({ userId }) => userId === rotation.currentUserId,
  );
  const current = rotation.members[currentIndex];
  const next = rotation.members[(currentIndex + 1) % rotation.members.length];
  const admin = createAdminClient();
  let { data: claim, error: claimError } = await admin
    .from('TriagerRotationNotification')
    .insert({ weekStartsOn: rotation.weekStartsOn, status: 'PROCESSING' })
    .select('weekStartsOn')
    .maybeSingle();
  if (claimError?.code === '23505') {
    const staleBefore = new Date(now.getTime() - 10 * 60 * 1000).toISOString();
    const reclaimed = await admin
      .from('TriagerRotationNotification')
      .update({ status: 'PROCESSING', createdAt: now.toISOString() })
      .eq('weekStartsOn', rotation.weekStartsOn)
      .eq('status', 'PROCESSING')
      .lt('createdAt', staleBefore)
      .select('weekStartsOn')
      .maybeSingle();
    claim = reclaimed.data;
    claimError = reclaimed.error;
  }
  if (claimError) throw claimError;
  if (!claim) return { skipped: true, reason: 'already-notified' };

  const triageChannelId = getServerEnv().DISCORD_TRIAGE_CHANNEL_ID;
  if (!triageChannelId) {
    await admin
      .from('TriagerRotationNotification')
      .delete()
      .eq('weekStartsOn', rotation.weekStartsOn);
    throw new Error('Falta configuración Discord: triageChannelId');
  }

  try {
    await sendChannelMessage(triageChannelId, {
      content:
        current.discordUserId === next.discordUserId
          ? `🔴 **Turno de Barbilla Roja**\nEsta semana le toca a <@${current.discordUserId}>. La próxima semana repite el turno.`
          : `🔴 **Turno de Barbilla Roja**\nEsta semana le toca a <@${current.discordUserId}>.\nLa próxima semana: <@${next.discordUserId}>.`,
      allowed_mentions: {
        parse: [],
        users: [...new Set([current.discordUserId, next.discordUserId])],
      },
    });
  } catch (error) {
    await admin
      .from('TriagerRotationNotification')
      .delete()
      .eq('weekStartsOn', rotation.weekStartsOn);
    throw error;
  }
  const { error: sentError } = await admin
    .from('TriagerRotationNotification')
    .update({ status: 'SENT', sentAt: new Date().toISOString() })
    .eq('weekStartsOn', rotation.weekStartsOn);
  if (sentError) throw sentError;
  return { sent: true, weekStartsOn: rotation.weekStartsOn };
}
