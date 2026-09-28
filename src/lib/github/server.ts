import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { AuthenticatedUser } from '@/lib/auth';
import {
  requireAdmin,
  requireKanbanManager,
  requireLeader,
  requireTeamManager,
} from '@/lib/kanbans/authorization';
import { HttpError } from '@/lib/http';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  getGithubInstallation,
  getGithubInstallUrl,
  listInstallationRepositories,
} from '@/lib/github/client';
import type { GithubPullRequest, GithubRepository } from '@/lib/types';

function repositoryFromRow(row: Record<string, unknown>): GithubRepository {
  return {
    id: row.id as string,
    githubId: String(row.githubId),
    organizationId: row.organizationId as string,
    owner: row.owner as string,
    name: row.name as string,
    fullName: row.fullName as string,
    htmlUrl: row.htmlUrl as string,
    defaultBranch: row.defaultBranch as string | null,
  };
}

function nestedObject(value: unknown) {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate && typeof candidate === 'object'
    ? (candidate as Record<string, unknown>)
    : null;
}

export function createGithubInstallUrl(
  actor: AuthenticatedUser,
  state: string,
) {
  requireAdmin(actor);
  return getGithubInstallUrl(state);
}

export async function syncGithubInstallation(
  actor: AuthenticatedUser,
  installationId: string,
) {
  requireAdmin(actor);
  const installation = await getGithubInstallation(installationId);
  if (installation.account.type !== 'Organization')
    throw new HttpError(
      'La instalación debe pertenecer a una organización',
      400,
    );
  const admin = createAdminClient();
  const { data: organization, error: organizationError } = await admin
    .from('GithubOrganization')
    .upsert(
      {
        login: installation.account.login,
        installationId: installation.id,
        createdByUserId: actor.id,
        status: 'ACTIVE',
      },
      { onConflict: 'installationId' },
    )
    .select('id, login, installationId')
    .single();
  if (organizationError) throw new Error(organizationError.message);
  const repositories = await listInstallationRepositories(installationId);
  for (const repository of repositories) {
    const { error } = await admin.from('GithubRepository').upsert(
      {
        githubId: repository.id,
        organizationId: organization.id,
        owner: repository.owner.login,
        name: repository.name,
        fullName: repository.full_name,
        htmlUrl: repository.html_url,
        defaultBranch: repository.default_branch,
        status: 'ACTIVE',
      },
      { onConflict: 'githubId' },
    );
    if (error) throw new Error(error.message);
  }
  return {
    organizationId: organization.id as string,
    repositoryCount: repositories.length,
  };
}

export async function listGithubRepositories(actor: AuthenticatedUser) {
  await requireLeader(actor);
  const query = createAdminClient()
    .from('GithubRepository')
    .select(
      'id, githubId, organizationId, owner, name, fullName, htmlUrl, defaultBranch',
    )
    .eq('status', 'ACTIVE')
    .order('fullName');
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => repositoryFromRow(row));
}

export async function listTeamGithubRepositories(
  actor: AuthenticatedUser,
  teamId: string,
) {
  await requireTeamManager(actor, teamId);
  const { data, error } = await createAdminClient()
    .from('TeamGithubRepository')
    .select(
      'id, repositoryId, GithubRepository(id, githubId, organizationId, owner, name, fullName, htmlUrl, defaultBranch)',
    )
    .eq('teamId', teamId)
    .eq('status', 'ACTIVE');
  if (error) throw new Error(error.message);
  return (data ?? []).flatMap((row) => {
    const repository = nestedObject(row.GithubRepository);
    return repository
      ? [{ linkId: row.id as string, ...repositoryFromRow(repository) }]
      : [];
  });
}

export async function linkGithubRepositoryToTeam(
  actor: AuthenticatedUser,
  teamId: string,
  repositoryId: string,
  kanbanIds: string[],
) {
  await requireTeamManager(actor, teamId);
  const admin = createAdminClient();
  const { data: repository, error: repositoryError } = await admin
    .from('GithubRepository')
    .select('id')
    .eq('id', repositoryId)
    .eq('status', 'ACTIVE')
    .maybeSingle();
  if (repositoryError) throw new Error(repositoryError.message);
  if (!repository) throw new HttpError('Repositorio no encontrado', 404);
  const { data: teamKanbans, error: kanbanError } = await admin
    .from('KanbanTeam')
    .select('kanbanId')
    .eq('teamId', teamId)
    .eq('status', 'ACTIVE');
  if (kanbanError) throw new Error(kanbanError.message);
  const allowedKanbanIds = new Set(
    (teamKanbans ?? []).map((row) => row.kanbanId as string),
  );
  if (kanbanIds.some((kanbanId) => !allowedKanbanIds.has(kanbanId)))
    throw new HttpError('Uno o más kanbans no pertenecen al equipo', 400);
  const { data: currentTeamLink, error: currentTeamLinkError } = await admin
    .from('TeamGithubRepository')
    .select('id')
    .eq('teamId', teamId)
    .eq('repositoryId', repositoryId)
    .maybeSingle();
  if (currentTeamLinkError) throw new Error(currentTeamLinkError.message);
  if (currentTeamLink) {
    const { error } = await admin
      .from('TeamGithubRepository')
      .update({ status: 'ACTIVE', createdByUserId: actor.id })
      .eq('id', currentTeamLink.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await admin
      .from('TeamGithubRepository')
      .insert({ teamId, repositoryId, createdByUserId: actor.id });
    if (error) throw new Error(error.message);
  }
  for (const kanbanId of [...new Set(kanbanIds)]) {
    const { data: currentKanbanLink, error: currentKanbanLinkError } =
      await admin
        .from('KanbanGithubRepository')
        .select('id')
        .eq('kanbanId', kanbanId)
        .eq('repositoryId', repositoryId)
        .maybeSingle();
    if (currentKanbanLinkError) throw new Error(currentKanbanLinkError.message);
    if (currentKanbanLink) {
      const { error } = await admin
        .from('KanbanGithubRepository')
        .update({ status: 'ACTIVE', createdByUserId: actor.id })
        .eq('id', currentKanbanLink.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await admin
        .from('KanbanGithubRepository')
        .insert({ kanbanId, repositoryId, createdByUserId: actor.id });
      if (error) throw new Error(error.message);
    }
  }
  return { repositoryId, kanbanIds: [...new Set(kanbanIds)] };
}

export async function unlinkGithubRepositoryFromTeam(
  actor: AuthenticatedUser,
  teamId: string,
  repositoryId: string,
) {
  await requireTeamManager(actor, teamId);
  const { error } = await createAdminClient()
    .from('TeamGithubRepository')
    .update({ status: 'CANCELLED' })
    .eq('teamId', teamId)
    .eq('repositoryId', repositoryId)
    .eq('status', 'ACTIVE');
  if (error) throw new Error(error.message);
  return { teamId, repositoryId };
}

export async function updateKanbanGithubRepositories(
  actor: AuthenticatedUser,
  kanbanId: string,
  repositoryIds: string[],
) {
  await requireKanbanManager(actor, kanbanId);
  const admin = createAdminClient();
  const uniqueRepositoryIds = [...new Set(repositoryIds)];
  if (uniqueRepositoryIds.length) {
    const { data: repositories, error: repositoryError } = await admin
      .from('GithubRepository')
      .select('id')
      .in('id', uniqueRepositoryIds)
      .eq('status', 'ACTIVE');
    if (repositoryError) throw new Error(repositoryError.message);
    if (repositories?.length !== uniqueRepositoryIds.length)
      throw new HttpError('Uno o más repositorios no están disponibles', 400);
  }
  const { data: current, error: currentError } = await admin
    .from('KanbanGithubRepository')
    .select('id, repositoryId')
    .eq('kanbanId', kanbanId)
    .eq('status', 'ACTIVE');
  if (currentError) throw new Error(currentError.message);
  const removed = (current ?? []).filter(
    (row) => !uniqueRepositoryIds.includes(row.repositoryId as string),
  );
  if (removed.length) {
    const { error } = await admin
      .from('KanbanGithubRepository')
      .update({ status: 'CANCELLED' })
      .in(
        'id',
        removed.map((row) => row.id as string),
      );
    if (error) throw new Error(error.message);
  }
  const currentIds = new Set(
    (current ?? []).map((row) => row.repositoryId as string),
  );
  const additions = uniqueRepositoryIds.filter((id) => !currentIds.has(id));
  if (additions.length) {
    const { error } = await admin.from('KanbanGithubRepository').insert(
      additions.map((repositoryId) => ({
        kanbanId,
        repositoryId,
        createdByUserId: actor.id,
      })),
    );
    if (error) throw new Error(error.message);
  }
  return { kanbanId, repositoryIds: uniqueRepositoryIds };
}

export async function listKanbanGithubRepositories(
  actor: AuthenticatedUser,
  kanbanId: string,
) {
  await requireKanbanManager(actor, kanbanId);
  const { data, error } = await createAdminClient()
    .from('KanbanGithubRepository')
    .select(
      'repositoryId, GithubRepository(id, githubId, organizationId, owner, name, fullName, htmlUrl, defaultBranch)',
    )
    .eq('kanbanId', kanbanId)
    .eq('status', 'ACTIVE');
  if (error) throw new Error(error.message);
  return (data ?? []).flatMap((row) => {
    const repository = nestedObject(row.GithubRepository);
    return repository ? repositoryFromRow(repository) : [];
  });
}

export function parseKanbanCardCodes(title: string) {
  return [...title.matchAll(/\[?([A-Z][A-Z0-9]{1,9})-(\d+)\]?/gi)].map(
    (match) => `${match[1].toUpperCase()}-${match[2]}`,
  );
}

export async function listCardPullRequests(cardIds: string[]) {
  if (!cardIds.length) return new Map<string, GithubPullRequest[]>();
  const { data, error } = await createAdminClient()
    .from('KanbanCardGithubPullRequest')
    .select(
      'cardId, GithubPullRequest(id, repositoryId, number, title, state, isDraft, authorLogin, url, githubCreatedAt, githubUpdatedAt, githubClosedAt, githubMergedAt, GithubRepository(fullName, htmlUrl))',
    )
    .in('cardId', cardIds)
    .eq('status', 'ACTIVE');
  if (error) throw new Error(error.message);
  const result = new Map<string, GithubPullRequest[]>();
  for (const row of data ?? []) {
    const pullRequest = nestedObject(row.GithubPullRequest);
    if (!pullRequest) continue;
    const repository = nestedObject(pullRequest.GithubRepository);
    if (!repository) continue;
    const serialized: GithubPullRequest = {
      id: pullRequest.id as string,
      repositoryId: pullRequest.repositoryId as string,
      number: pullRequest.number as number,
      title: pullRequest.title as string,
      state: pullRequest.state as GithubPullRequest['state'],
      isDraft: pullRequest.isDraft as boolean,
      authorLogin: pullRequest.authorLogin as string | null,
      url: pullRequest.url as string,
      githubCreatedAt: pullRequest.githubCreatedAt as string | null,
      githubUpdatedAt: pullRequest.githubUpdatedAt as string | null,
      githubClosedAt: pullRequest.githubClosedAt as string | null,
      githubMergedAt: pullRequest.githubMergedAt as string | null,
      repository: {
        fullName: repository.fullName as string,
        htmlUrl: repository.htmlUrl as string,
      },
    };
    const current = result.get(row.cardId as string) ?? [];
    current.push(serialized);
    result.set(row.cardId as string, current);
  }
  return result;
}

export function verifyGithubSignature(payload: string, signature: string) {
  const { webhookSecret } = requireGithubWebhookEnv();
  if (!signature.startsWith('sha256=')) return false;
  const expected = createHmac('sha256', webhookSecret)
    .update(payload)
    .digest('hex');
  const received = signature.slice('sha256='.length);
  if (received.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(received), Buffer.from(expected));
}

function requireGithubWebhookEnv() {
  const value = process.env.GITHUB_WEBHOOK_SECRET;
  if (!value) throw new HttpError('GitHub webhook no configurado', 503);
  return { webhookSecret: value };
}

type GithubPullRequestPayload = {
  action: string;
  installation?: { id: number };
  repository: {
    id: number;
    full_name: string;
    owner: { login: string };
    name: string;
    html_url: string;
    default_branch: string | null;
  };
  pull_request: {
    id: number;
    number: number;
    title: string;
    state: 'open' | 'closed';
    draft: boolean | null;
    html_url: string;
    user: { login: string } | null;
    created_at: string;
    updated_at: string;
    closed_at: string | null;
    merged_at: string | null;
  };
  sender?: { login: string };
};

export async function processGithubWebhook(
  payloadText: string,
  signature: string | null,
  deliveryId: string | null,
  eventName: string | null,
) {
  if (!signature || !verifyGithubSignature(payloadText, signature))
    throw new HttpError('Firma de webhook inválida', 401);
  if (!deliveryId || !eventName)
    throw new HttpError('Faltan headers del webhook', 400);
  const payload = JSON.parse(payloadText) as Record<string, unknown>;
  const admin = createAdminClient();
  const { data: existingDelivery, error: deliveryLookupError } = await admin
    .from('GithubWebhookDelivery')
    .select('id')
    .eq('deliveryId', deliveryId)
    .maybeSingle();
  if (deliveryLookupError) throw new Error(deliveryLookupError.message);
  if (existingDelivery) return { duplicate: true };
  const { data: delivery, error: deliveryError } = await admin
    .from('GithubWebhookDelivery')
    .insert({ deliveryId, event: eventName, payload })
    .select('id')
    .single();
  if (deliveryError) {
    if (deliveryError.code === '23505') return { duplicate: true };
    throw new Error(deliveryError.message);
  }
  if (eventName === 'installation_repositories') {
    const installationId = (payload.installation as { id?: number } | undefined)
      ?.id;
    const accountLogin = (
      payload.installation as { account?: { login?: string } } | undefined
    )?.account?.login;
    if (installationId && accountLogin) {
      const { data: organization, error: organizationError } = await admin
        .from('GithubOrganization')
        .select('id, createdByUserId')
        .eq('installationId', installationId)
        .eq('status', 'ACTIVE')
        .maybeSingle();
      if (!organizationError && organization) {
        const repositories = await listInstallationRepositories(
          String(installationId),
        );
        for (const repository of repositories) {
          const { error } = await admin.from('GithubRepository').upsert(
            {
              githubId: repository.id,
              organizationId: organization.id,
              owner: repository.owner.login,
              name: repository.name,
              fullName: repository.full_name,
              htmlUrl: repository.html_url,
              defaultBranch: repository.default_branch,
              status: 'ACTIVE',
            },
            { onConflict: 'githubId' },
          );
          if (error) throw new Error(error.message);
        }
      }
    }
    await admin
      .from('GithubWebhookDelivery')
      .update({ processedAt: new Date().toISOString() })
      .eq('id', delivery.id);
    return { processed: true, event: eventName };
  }
  if (eventName !== 'pull_request') {
    await admin
      .from('GithubWebhookDelivery')
      .update({ processedAt: new Date().toISOString() })
      .eq('id', delivery.id);
    return { processed: false };
  }
  const pullRequestPayload = payload as unknown as GithubPullRequestPayload;
  const supportedActions = new Set(['opened', 'edited', 'reopened', 'closed']);
  if (!supportedActions.has(pullRequestPayload.action)) {
    await admin
      .from('GithubWebhookDelivery')
      .update({ processedAt: new Date().toISOString() })
      .eq('id', delivery.id);
    return { processed: false };
  }
  const { data: repository, error: repositoryError } = await admin
    .from('GithubRepository')
    .select('id')
    .eq('githubId', pullRequestPayload.repository.id)
    .eq('status', 'ACTIVE')
    .maybeSingle();
  if (repositoryError) throw new Error(repositoryError.message);
  if (!repository) {
    await admin
      .from('GithubWebhookDelivery')
      .update({ processedAt: new Date().toISOString() })
      .eq('id', delivery.id);
    return { processed: false, reason: 'repository_not_registered' };
  }
  const pullRequest = pullRequestPayload.pull_request;
  const state = pullRequest.merged_at
    ? 'MERGED'
    : pullRequest.state === 'open'
      ? 'OPEN'
      : 'CLOSED';
  const { data: currentPullRequest, error: currentError } = await admin
    .from('GithubPullRequest')
    .select('id, title')
    .eq('githubId', pullRequest.id)
    .maybeSingle();
  if (currentError) throw new Error(currentError.message);
  const pullRequestData = {
    repositoryId: repository.id,
    githubId: pullRequest.id,
    number: pullRequest.number,
    title: pullRequest.title,
    state,
    isDraft: Boolean(pullRequest.draft),
    authorLogin: pullRequest.user?.login ?? null,
    url: pullRequest.html_url,
    githubCreatedAt: pullRequest.created_at,
    githubUpdatedAt: pullRequest.updated_at,
    githubClosedAt: pullRequest.closed_at,
    githubMergedAt: pullRequest.merged_at,
  };
  let pullRequestId = currentPullRequest?.id as string | undefined;
  if (pullRequestId) {
    const { error } = await admin
      .from('GithubPullRequest')
      .update(pullRequestData)
      .eq('id', pullRequestId);
    if (error) throw new Error(error.message);
  } else {
    const { data, error } = await admin
      .from('GithubPullRequest')
      .insert(pullRequestData)
      .select('id')
      .single();
    if (error) throw new Error(error.message);
    pullRequestId = data.id as string;
  }
  const changes: Record<string, unknown> = {
    action: pullRequestPayload.action,
    state,
  };
  if (currentPullRequest && currentPullRequest.title !== pullRequest.title) {
    changes.previousTitle = currentPullRequest.title;
    changes.title = pullRequest.title;
  }
  const { error: activityError } = await admin
    .from('GithubPullRequestActivity')
    .insert({
      pullRequestId,
      event: `pull_request.${pullRequestPayload.action}`,
      actorLogin: pullRequestPayload.sender?.login ?? null,
      changes,
    });
  if (activityError) throw new Error(activityError.message);
  const codes = parseKanbanCardCodes(pullRequest.title);
  if (codes.length) {
    const codePrefixes = [...new Set(codes.map((code) => code.split('-')[0]))];
    const { data: kanbans, error: kanbanError } = await admin
      .from('Kanban')
      .select('id, code')
      .in('code', codePrefixes)
      .eq('status', 'ACTIVE');
    if (kanbanError) throw new Error(kanbanError.message);
    for (const code of codes) {
      const [prefix, numberValue] = code.split('-');
      const kanban = (kanbans ?? []).find((row) => row.code === prefix);
      if (!kanban) continue;
      const { data: repositoryLink, error: repositoryLinkError } = await admin
        .from('KanbanGithubRepository')
        .select('id')
        .eq('kanbanId', kanban.id)
        .eq('repositoryId', repository.id)
        .eq('status', 'ACTIVE')
        .maybeSingle();
      if (repositoryLinkError) throw new Error(repositoryLinkError.message);
      if (!repositoryLink) continue;
      const { data: card, error: cardError } = await admin
        .from('KanbanCard')
        .select('id')
        .eq('kanbanId', kanban.id)
        .eq('number', Number(numberValue))
        .eq('status', 'ACTIVE')
        .maybeSingle();
      if (cardError) throw new Error(cardError.message);
      if (!card) continue;
      const { data: existingLink, error: linkLookupError } = await admin
        .from('KanbanCardGithubPullRequest')
        .select('id')
        .eq('cardId', card.id)
        .eq('pullRequestId', pullRequestId)
        .eq('status', 'ACTIVE')
        .maybeSingle();
      if (linkLookupError) throw new Error(linkLookupError.message);
      if (!existingLink) {
        const { error: linkError } = await admin
          .from('KanbanCardGithubPullRequest')
          .insert({ cardId: card.id, pullRequestId });
        if (linkError && linkError.code !== '23505')
          throw new Error(linkError.message);
      }
    }
  }
  const { error: processedError } = await admin
    .from('GithubWebhookDelivery')
    .update({ processedAt: new Date().toISOString() })
    .eq('id', delivery.id);
  if (processedError) throw new Error(processedError.message);
  return { processed: true, pullRequestId };
}
