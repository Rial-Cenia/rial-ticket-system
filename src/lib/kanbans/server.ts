import 'server-only';
import type { AuthenticatedUser } from '@/lib/auth';
import type {
  CreateKanbanCardInput,
  UpdateKanbanCardInput,
} from '@/lib/schemas';
import { HttpError } from '@/lib/http';
import {
  getLeaderTeamIds,
  requireKanbanManager,
  requireKanbanMember,
  requireLeader,
} from '@/lib/kanbans/authorization';
import { createAdminClient } from '@/lib/supabase/admin';
import { listUserDirectory } from '@/lib/users/server';
import type { Kanban, KanbanPriority } from '@/lib/types';

interface KanbanTeamRow {
  kanbanId: string;
  teamId: string;
}

interface MembershipRow {
  teamId: string;
  userId: string;
  role: 'LEADER' | 'MEMBER';
}

export async function listKanbans(actor: AuthenticatedUser): Promise<Kanban[]> {
  const admin = createAdminClient();
  const { data: kanbanTeamsData, error: associationError } = await admin
    .from('KanbanTeam')
    .select('kanbanId, teamId')
    .eq('status', 'ACTIVE');
  if (associationError) throw new Error(associationError.message);
  const kanbanTeams = (kanbanTeamsData ?? []) as KanbanTeamRow[];

  const { data: membershipsData, error: membershipError } = await admin
    .from('TeamMembership')
    .select('teamId, userId, role')
    .eq('status', 'ACTIVE');
  if (membershipError) throw new Error(membershipError.message);
  const memberships = (membershipsData ?? []) as MembershipRow[];
  const actorTeamIds = new Set(
    memberships
      .filter((membership) => membership.userId === actor.id)
      .map((membership) => membership.teamId),
  );
  const visibleKanbanIds = new Set(
    kanbanTeams
      .filter((association) => actorTeamIds.has(association.teamId))
      .map((association) => association.kanbanId),
  );
  if (actor.role === 'ADMIN') {
    const { data: allKanbans, error } = await admin
      .from('Kanban')
      .select('id')
      .eq('status', 'ACTIVE');
    if (error) throw new Error(error.message);
    for (const kanban of allKanbans ?? [])
      visibleKanbanIds.add(kanban.id as string);
  }
  if (!visibleKanbanIds.size) return [];
  const kanbanIds = [...visibleKanbanIds];

  const [
    { data: kanbans, error: kanbanError },
    { data: teams, error: teamError },
    { data: states, error: stateError },
    { data: tags, error: tagError },
    { data: cards, error: cardError },
    { data: cardTags, error: cardTagError },
    users,
  ] = await Promise.all([
    admin
      .from('Kanban')
      .select('id, name, createdAt, updatedAt')
      .in('id', kanbanIds)
      .eq('status', 'ACTIVE')
      .order('name'),
    admin.from('Team').select('id, name').eq('status', 'ACTIVE'),
    admin
      .from('KanbanState')
      .select('id, kanbanId, name, position')
      .in('kanbanId', kanbanIds)
      .eq('status', 'ACTIVE')
      .order('position'),
    admin
      .from('KanbanTag')
      .select('id, kanbanId, name')
      .in('kanbanId', kanbanIds)
      .eq('status', 'ACTIVE')
      .order('name'),
    admin
      .from('KanbanCard')
      .select(
        'id, kanbanId, title, description, stateId, priority, assigneeUserId, reviewerUserId, createdByUserId, createdAt, updatedAt',
      )
      .in('kanbanId', kanbanIds)
      .eq('status', 'ACTIVE')
      .order('updatedAt', { ascending: false }),
    admin.from('KanbanCardTag').select('cardId, tagId').eq('status', 'ACTIVE'),
    listUserDirectory(),
  ]);
  for (const error of [
    kanbanError,
    teamError,
    stateError,
    tagError,
    cardError,
    cardTagError,
  ])
    if (error) throw new Error(error.message);

  const usersById = new Map(users.map((user) => [user.userId, user]));
  const teamsById = new Map(
    (teams ?? []).map((team) => [team.id as string, team.name as string]),
  );
  const tagsById = new Map((tags ?? []).map((tag) => [tag.id as string, tag]));
  const tagsByCardId = new Map<string, unknown[]>();
  for (const association of cardTags ?? []) {
    const tag = tagsById.get(association.tagId as string);
    if (!tag) continue;
    const current = tagsByCardId.get(association.cardId as string) ?? [];
    current.push(tag);
    tagsByCardId.set(association.cardId as string, current);
  }

  return (kanbans ?? []).map((kanban) => {
    const boardTeamIds = kanbanTeams
      .filter((association) => association.kanbanId === kanban.id)
      .map((association) => association.teamId);
    const memberIds = new Set(
      memberships
        .filter((membership) => boardTeamIds.includes(membership.teamId))
        .map((membership) => membership.userId),
    );
    const isLeader = memberships.some(
      (membership) =>
        membership.userId === actor.id &&
        membership.role === 'LEADER' &&
        boardTeamIds.includes(membership.teamId),
    );
    const serializeAssignedUser = (userId: unknown) => {
      if (typeof userId !== 'string') return null;
      const user = usersById.get(userId);
      if (!user) return null;
      return { ...user, isCurrentMember: memberIds.has(userId) };
    };
    return {
      id: kanban.id as string,
      name: kanban.name as string,
      createdAt: kanban.createdAt as string,
      updatedAt: kanban.updatedAt as string,
      teams: boardTeamIds.flatMap((teamId) => {
        const name = teamsById.get(teamId);
        return name ? [{ id: teamId, name }] : [];
      }),
      states: (states ?? []).filter((state) => state.kanbanId === kanban.id),
      tags: (tags ?? []).filter((tag) => tag.kanbanId === kanban.id),
      members: [...memberIds].flatMap((userId) => {
        const user = usersById.get(userId);
        return user ? [user] : [];
      }),
      cards: (cards ?? [])
        .filter((card) => card.kanbanId === kanban.id)
        .map((card) => ({
          id: card.id as string,
          kanbanId: card.kanbanId as string,
          title: card.title as string,
          description: card.description as string,
          stateId: card.stateId as string,
          priority: card.priority as KanbanPriority,
          assignee: serializeAssignedUser(card.assigneeUserId),
          reviewer: serializeAssignedUser(card.reviewerUserId),
          tags: (tagsByCardId.get(card.id as string) ?? []) as Kanban['tags'],
          createdByUserId: card.createdByUserId as string,
          createdAt: card.createdAt as string,
          updatedAt: card.updatedAt as string,
        })),
      canManage: actor.role === 'ADMIN' || isLeader,
      canDeleteCards: actor.role === 'ADMIN' || isLeader,
    };
  });
}

export async function createKanban(
  actor: AuthenticatedUser,
  name: string,
  teamIds: string[],
) {
  const leaderTeamIds = await requireLeader(actor);
  if (
    leaderTeamIds !== null &&
    teamIds.some((teamId) => !leaderTeamIds.includes(teamId))
  )
    throw new HttpError(
      'Solo puedes asignar kanbans a equipos que lideras',
      403,
    );
  const { data, error } = await createAdminClient().rpc('create_kanban', {
    p_name: name,
    p_team_ids: [...new Set(teamIds)],
    p_actor_id: actor.id,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function updateKanban(
  actor: AuthenticatedUser,
  kanbanId: string,
  patch: { name?: string; teamIds?: string[] },
) {
  await requireKanbanManager(actor, kanbanId);
  const admin = createAdminClient();
  if (patch.name) {
    const { error } = await admin
      .from('Kanban')
      .update({ name: patch.name })
      .eq('id', kanbanId)
      .eq('status', 'ACTIVE');
    if (error) throw new Error(error.message);
  }
  if (patch.teamIds) {
    const teamIds = [...new Set(patch.teamIds)];
    if (!teamIds.length)
      throw new HttpError('El kanban debe tener al menos un equipo', 400);
    const leaderTeamIds = await getLeaderTeamIds(actor);
    const { data: activeTeams, error: teamError } = await admin
      .from('Team')
      .select('id')
      .in('id', teamIds)
      .eq('status', 'ACTIVE');
    if (teamError) throw new Error(teamError.message);
    if (activeTeams?.length !== teamIds.length)
      throw new HttpError('Uno o más equipos no están disponibles', 400);
    const { data: current, error: currentError } = await admin
      .from('KanbanTeam')
      .select('id, teamId')
      .eq('kanbanId', kanbanId)
      .eq('status', 'ACTIVE');
    if (currentError) throw new Error(currentError.message);
    const currentTeamIds = new Set(
      (current ?? []).map((entry) => entry.teamId as string),
    );
    if (
      leaderTeamIds !== null &&
      teamIds.some(
        (teamId) =>
          !currentTeamIds.has(teamId) && !leaderTeamIds.includes(teamId),
      )
    )
      throw new HttpError('Solo puedes agregar equipos que lideras', 403);
    const removedIds = (current ?? [])
      .filter((entry) => !teamIds.includes(entry.teamId as string))
      .map((entry) => entry.id as string);
    if (removedIds.length) {
      const { error } = await admin
        .from('KanbanTeam')
        .update({ status: 'CANCELLED' })
        .in('id', removedIds);
      if (error) throw new Error(error.message);
    }
    const additions = teamIds.filter((teamId) => !currentTeamIds.has(teamId));
    if (additions.length) {
      const { error } = await admin
        .from('KanbanTeam')
        .insert(additions.map((teamId) => ({ kanbanId, teamId })));
      if (error) throw new Error(error.message);
    }
  }
  return { id: kanbanId };
}

export async function cancelKanban(actor: AuthenticatedUser, kanbanId: string) {
  await requireKanbanManager(actor, kanbanId);
  const { error } = await createAdminClient().rpc('cancel_kanban', {
    p_kanban_id: kanbanId,
  });
  if (error) throw new Error(error.message);
  return { id: kanbanId, status: 'CANCELLED' as const };
}

export async function createKanbanState(
  actor: AuthenticatedUser,
  kanbanId: string,
  name: string,
) {
  await requireKanbanManager(actor, kanbanId);
  const admin = createAdminClient();
  const { data: last } = await admin
    .from('KanbanState')
    .select('position')
    .eq('kanbanId', kanbanId)
    .eq('status', 'ACTIVE')
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data, error } = await admin
    .from('KanbanState')
    .insert({ kanbanId, name, position: (last?.position ?? -1) + 1 })
    .select('id, kanbanId, name, position')
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateKanbanState(
  actor: AuthenticatedUser,
  kanbanId: string,
  stateId: string,
  patch: { name?: string; position?: number },
) {
  await requireKanbanManager(actor, kanbanId);
  const { data, error } = await createAdminClient()
    .from('KanbanState')
    .update(patch)
    .eq('id', stateId)
    .eq('kanbanId', kanbanId)
    .eq('status', 'ACTIVE')
    .select('id, kanbanId, name, position')
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new HttpError('Estado no encontrado', 404);
  return data;
}

export async function reorderKanbanStates(
  actor: AuthenticatedUser,
  kanbanId: string,
  stateIds: string[],
) {
  await requireKanbanManager(actor, kanbanId);
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('KanbanState')
    .select('id')
    .eq('kanbanId', kanbanId)
    .eq('status', 'ACTIVE');
  if (error) throw new Error(error.message);
  const currentIds = (data ?? []).map((state) => state.id as string);
  if (
    stateIds.length !== currentIds.length ||
    new Set(stateIds).size !== stateIds.length ||
    stateIds.some((stateId) => !currentIds.includes(stateId))
  )
    throw new HttpError(
      'Debes incluir todos los estados activos una sola vez',
      400,
    );
  await Promise.all(
    stateIds.map(async (stateId, position) => {
      const { error: updateError } = await admin
        .from('KanbanState')
        .update({ position })
        .eq('id', stateId);
      if (updateError) throw new Error(updateError.message);
    }),
  );
  return { stateIds };
}

export async function cancelKanbanState(
  actor: AuthenticatedUser,
  kanbanId: string,
  stateId: string,
) {
  await requireKanbanManager(actor, kanbanId);
  await requireActiveResource(
    'KanbanState',
    stateId,
    kanbanId,
    'Estado no encontrado',
  );
  const { error } = await createAdminClient().rpc('cancel_kanban_state', {
    p_state_id: stateId,
  });
  if (error) throw new Error(error.message);
  return { id: stateId, status: 'CANCELLED' as const };
}

export async function createKanbanTag(
  actor: AuthenticatedUser,
  kanbanId: string,
  name: string,
) {
  await requireKanbanManager(actor, kanbanId);
  const { data, error } = await createAdminClient()
    .from('KanbanTag')
    .insert({ kanbanId, name })
    .select('id, kanbanId, name')
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateKanbanTag(
  actor: AuthenticatedUser,
  kanbanId: string,
  tagId: string,
  name: string,
) {
  await requireKanbanManager(actor, kanbanId);
  const { data, error } = await createAdminClient()
    .from('KanbanTag')
    .update({ name })
    .eq('id', tagId)
    .eq('kanbanId', kanbanId)
    .eq('status', 'ACTIVE')
    .select('id, kanbanId, name')
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new HttpError('Etiqueta no encontrada', 404);
  return data;
}

export async function cancelKanbanTag(
  actor: AuthenticatedUser,
  kanbanId: string,
  tagId: string,
) {
  await requireKanbanManager(actor, kanbanId);
  await requireActiveResource(
    'KanbanTag',
    tagId,
    kanbanId,
    'Etiqueta no encontrada',
  );
  const { error } = await createAdminClient().rpc('cancel_kanban_tag', {
    p_tag_id: tagId,
  });
  if (error) throw new Error(error.message);
  return { id: tagId, status: 'CANCELLED' as const };
}

async function validateCardRelations(
  kanbanId: string,
  input: Partial<CreateKanbanCardInput>,
) {
  const admin = createAdminClient();
  if (input.stateId) {
    const { data } = await admin
      .from('KanbanState')
      .select('id')
      .eq('id', input.stateId)
      .eq('kanbanId', kanbanId)
      .eq('status', 'ACTIVE')
      .maybeSingle();
    if (!data) throw new HttpError('El estado no pertenece al kanban', 400);
  }
  if (input.tagIds) {
    const uniqueTagIds = [...new Set(input.tagIds)];
    if (uniqueTagIds.length) {
      const { data } = await admin
        .from('KanbanTag')
        .select('id')
        .in('id', uniqueTagIds)
        .eq('kanbanId', kanbanId)
        .eq('status', 'ACTIVE');
      if (data?.length !== uniqueTagIds.length)
        throw new HttpError('Una o más etiquetas no pertenecen al kanban', 400);
    }
  }
  const userIds = [input.assigneeUserId, input.reviewerUserId].filter(
    (userId): userId is string => Boolean(userId),
  );
  if (userIds.length) {
    const { data: boardTeams } = await admin
      .from('KanbanTeam')
      .select('teamId')
      .eq('kanbanId', kanbanId)
      .eq('status', 'ACTIVE');
    const teamIds = (boardTeams ?? []).map((entry) => entry.teamId as string);
    const { data: memberships } = await admin
      .from('TeamMembership')
      .select('userId')
      .in('teamId', teamIds)
      .in('userId', userIds)
      .eq('status', 'ACTIVE');
    const memberIds = new Set(
      (memberships ?? []).map((entry) => entry.userId as string),
    );
    if (userIds.some((userId) => !memberIds.has(userId)))
      throw new HttpError(
        'Encargado y revisor deben pertenecer al kanban',
        400,
      );
  }
}

async function syncCardTags(
  kanbanId: string,
  cardId: string,
  tagIds: string[],
) {
  const admin = createAdminClient();
  const { data: current, error } = await admin
    .from('KanbanCardTag')
    .select('id, tagId')
    .eq('cardId', cardId)
    .eq('status', 'ACTIVE');
  if (error) throw new Error(error.message);
  const uniqueTagIds = [...new Set(tagIds)];
  const removed = (current ?? []).filter(
    (entry) => !uniqueTagIds.includes(entry.tagId as string),
  );
  if (removed.length) {
    const { error: updateError } = await admin
      .from('KanbanCardTag')
      .update({ status: 'CANCELLED' })
      .in(
        'id',
        removed.map((entry) => entry.id as string),
      );
    if (updateError) throw new Error(updateError.message);
  }
  const currentTagIds = new Set(
    (current ?? []).map((entry) => entry.tagId as string),
  );
  const added = uniqueTagIds.filter((tagId) => !currentTagIds.has(tagId));
  if (added.length) {
    const { error: insertError } = await admin
      .from('KanbanCardTag')
      .insert(added.map((tagId) => ({ kanbanId, cardId, tagId })));
    if (insertError) throw new Error(insertError.message);
  }
}

export async function createKanbanCard(
  actor: AuthenticatedUser,
  kanbanId: string,
  input: CreateKanbanCardInput,
) {
  await requireKanbanMember(actor, kanbanId);
  await validateCardRelations(kanbanId, input);
  const { tagIds, ...card } = input;
  const { data, error } = await createAdminClient()
    .from('KanbanCard')
    .insert({ ...card, kanbanId, createdByUserId: actor.id })
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  await syncCardTags(kanbanId, data.id as string, tagIds);
  return { id: data.id as string };
}

export async function updateKanbanCard(
  actor: AuthenticatedUser,
  kanbanId: string,
  cardId: string,
  input: UpdateKanbanCardInput,
) {
  await requireKanbanMember(actor, kanbanId);
  const { data: currentCard, error: currentError } = await createAdminClient()
    .from('KanbanCard')
    .select('assigneeUserId, reviewerUserId')
    .eq('id', cardId)
    .eq('kanbanId', kanbanId)
    .eq('status', 'ACTIVE')
    .maybeSingle();
  if (currentError) throw new Error(currentError.message);
  if (!currentCard) throw new HttpError('Tarjeta no encontrada', 404);
  const relationsToValidate = {
    ...input,
    ...(input.assigneeUserId === currentCard.assigneeUserId
      ? { assigneeUserId: undefined }
      : {}),
    ...(input.reviewerUserId === currentCard.reviewerUserId
      ? { reviewerUserId: undefined }
      : {}),
  };
  await validateCardRelations(kanbanId, relationsToValidate);
  const { tagIds, ...patch } = input;
  if (Object.keys(patch).length) {
    const { data, error } = await createAdminClient()
      .from('KanbanCard')
      .update(patch)
      .eq('id', cardId)
      .eq('kanbanId', kanbanId)
      .eq('status', 'ACTIVE')
      .select('id')
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new HttpError('Tarjeta no encontrada', 404);
  }
  if (tagIds) await syncCardTags(kanbanId, cardId, tagIds);
  return { id: cardId };
}

export async function cancelKanbanCard(
  actor: AuthenticatedUser,
  kanbanId: string,
  cardId: string,
) {
  await requireKanbanManager(actor, kanbanId);
  await requireActiveResource(
    'KanbanCard',
    cardId,
    kanbanId,
    'Tarjeta no encontrada',
  );
  const { error } = await createAdminClient().rpc('cancel_kanban_card', {
    p_card_id: cardId,
  });
  if (error) throw new Error(error.message);
  return { id: cardId, status: 'CANCELLED' as const };
}

async function requireActiveResource(
  table: 'KanbanState' | 'KanbanTag' | 'KanbanCard',
  id: string,
  kanbanId: string,
  message: string,
) {
  const { data, error } = await createAdminClient()
    .from(table)
    .select('id')
    .eq('id', id)
    .eq('kanbanId', kanbanId)
    .eq('status', 'ACTIVE')
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new HttpError(message, 404);
}
