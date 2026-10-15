import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { canTransitionCodexRun } from '@/lib/codex/policy';
import type { CodexRunStatus } from '@/lib/codex/types';
import type { Ticket } from '@/lib/types';

export interface CodexRunRecord {
  id: string;
  ticketPublicId: string;
  status: CodexRunStatus;
  repositoryFullName: string | null;
  pullRequestUrl: string | null;
  lastError: string | null;
  createdByDiscordId: string | null;
  createdAt: string;
  updatedAt: string;
}

const ACTIVE_STATUSES: readonly CodexRunStatus[] = [
  'ANALYZING',
  'WAITING_FOR_USER',
  'ANALYSIS_APPROVED',
  'IMPLEMENTING',
  'VERIFYING',
];

function isActiveStatus(status: CodexRunStatus) {
  return ACTIVE_STATUSES.includes(status);
}

async function recordEvent(
  runId: string,
  event: string,
  actorDiscordId: string,
  details: Record<string, unknown> = {},
) {
  const { error } = await createAdminClient().from('CodexRunEvent').insert({
    runId,
    event,
    actorDiscordId,
    details,
  });
  if (error) throw new Error(error.message);
}

export async function getLatestCodexRun(ticketPublicId: string) {
  const { data, error } = await createAdminClient()
    .from('CodexRun')
    .select(
      'id, ticketPublicId, status, repositoryFullName, pullRequestUrl, lastError, createdByDiscordId, createdAt, updatedAt',
    )
    .eq('ticketPublicId', ticketPublicId)
    .order('createdAt', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as CodexRunRecord | null) ?? null;
}

export async function requestCodexAnalysis(
  ticket: Ticket,
  actorDiscordId: string,
) {
  const existing = await getLatestCodexRun(ticket.publicId);
  if (existing && isActiveStatus(existing.status)) return existing;

  const { data, error } = await createAdminClient()
    .from('CodexRun')
    .insert({
      ticketPublicId: ticket.publicId,
      status: 'ANALYZING',
      createdByDiscordId: actorDiscordId,
    })
    .select(
      'id, ticketPublicId, status, repositoryFullName, pullRequestUrl, lastError, createdByDiscordId, createdAt, updatedAt',
    )
    .single();
  if (error) throw new Error(error.message);
  const run = data as CodexRunRecord;
  await recordEvent(run.id, 'ANALYSIS_REQUESTED', actorDiscordId, {
    ticketTitle: ticket.title,
  });
  return run;
}

export async function cancelCodexRun(
  run: CodexRunRecord,
  actorDiscordId: string,
) {
  if (!canTransitionCodexRun(run.status, 'CANCELLED'))
    throw new Error(
      `No se puede cancelar una ejecución en estado ${run.status}`,
    );

  const { data, error } = await createAdminClient()
    .from('CodexRun')
    .update({ status: 'CANCELLED' })
    .eq('id', run.id)
    .eq('status', run.status)
    .select(
      'id, ticketPublicId, status, repositoryFullName, pullRequestUrl, lastError, createdByDiscordId, createdAt, updatedAt',
    )
    .single();
  if (error) throw new Error(error.message);
  const cancelled = data as CodexRunRecord;
  await recordEvent(cancelled.id, 'RUN_CANCELLED', actorDiscordId);
  return cancelled;
}
