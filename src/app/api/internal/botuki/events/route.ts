import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { processOutboxJobs } from '@/lib/discord/jobs';
import { getBotukiEnv } from '@/lib/env/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTicket } from '@/lib/tickets/server';
import { ticketCode } from '@/lib/tickets/format';
import {
  calculateCodexUsageCost,
  formatCodexUsageCost,
} from '@/lib/codex/cost';

const eventSchema = z.object({
  runId: z.string().uuid(),
  event: z.enum(['PR_OPENED', 'IMPLEMENTATION_FAILED']),
  pullRequestUrl: z.string().url().optional(),
  repositoryFullName: z.string().optional(),
  pullRequestId: z.coerce.number().int().positive().optional(),
  pullRequestNumber: z.coerce.number().int().positive().optional(),
  pullRequestTitle: z.string().min(1).optional(),
  error: z.string().max(8000).optional(),
});

function validSignature(
  payload: string,
  signature: string | null,
  secret: string,
) {
  if (!signature) return false;
  const expected = createHmac('sha256', secret).update(payload).digest('hex');
  const received = signature.replace(/^sha256=/, '');
  if (received.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(received));
}

async function linkPullRequestToTicket(
  ticketPublicId: string,
  payload: z.infer<typeof eventSchema>,
) {
  if (
    payload.event !== 'PR_OPENED' ||
    !payload.repositoryFullName ||
    !payload.pullRequestId ||
    !payload.pullRequestNumber ||
    !payload.pullRequestTitle ||
    !payload.pullRequestUrl
  )
    return;

  const admin = createAdminClient();
  const { data: repository, error: repositoryError } = await admin
    .from('GithubRepository')
    .select('id')
    .eq('fullName', payload.repositoryFullName)
    .eq('status', 'ACTIVE')
    .maybeSingle();
  if (repositoryError) throw new Error(repositoryError.message);
  if (!repository) return;

  const { data: pullRequest, error: pullRequestError } = await admin
    .from('GithubPullRequest')
    .upsert(
      {
        repositoryId: repository.id,
        githubId: payload.pullRequestId,
        number: payload.pullRequestNumber,
        title: payload.pullRequestTitle,
        state: 'OPEN',
        isDraft: false,
        url: payload.pullRequestUrl,
      },
      { onConflict: 'githubId' },
    )
    .select('id')
    .single();
  if (pullRequestError) throw new Error(pullRequestError.message);

  const { data: cards, error: cardsError } = await admin
    .from('KanbanCard')
    .select('id')
    .eq('ticketPublicId', ticketPublicId)
    .eq('status', 'ACTIVE');
  if (cardsError) throw new Error(cardsError.message);
  if (!cards?.length) return;

  const { error: linksError } = await admin
    .from('KanbanCardGithubPullRequest')
    .upsert(
      cards.map((card) => ({
        cardId: card.id,
        pullRequestId: pullRequest.id,
      })),
      { onConflict: 'cardId,pullRequestId' },
    );
  if (linksError) throw new Error(linksError.message);
}

export async function POST(request: Request) {
  const env = getBotukiEnv();
  if (!env.runnerSharedSecret)
    return Response.json(
      { error: 'Botuki notifications are not configured' },
      { status: 503 },
    );
  const body = await request.text();
  if (
    !validSignature(
      body,
      request.headers.get('x-botuki-event-signature'),
      env.runnerSharedSecret,
    )
  )
    return Response.json({ error: 'Invalid signature' }, { status: 401 });
  try {
    const payload = eventSchema.parse(JSON.parse(body));
    const { data: run, error: runError } = await createAdminClient()
      .from('CodexRun')
      .select(
        'id, ticketPublicId, pullRequestUrl, repositoryFullName, branchName, status, attemptNumber',
      )
      .eq('id', payload.runId)
      .single();
    if (runError) throw new Error(runError.message);
    await linkPullRequestToTicket(run.ticketPublicId as string, payload);
    const ticket = await getTicket(run.ticketPublicId as string);
    if (!ticket?.discordThreadId)
      return Response.json({
        delivered: false,
        reason: 'ticket_thread_missing',
      });
    let executionCost: string | null = null;
    if (payload.event === 'PR_OPENED') {
      const { data: usage, error: usageError } = await createAdminClient()
        .from('CodexRunUsage')
        .select('phase, inputTokens, cachedInputTokens, outputTokens')
        .eq('runId', payload.runId);
      if (!usageError && usage?.length) {
        executionCost = formatCodexUsageCost(calculateCodexUsageCost(usage));
      }
    }
    const notificationEvent = `DISCORD_${payload.event}`;
    const { data: existing, error: eventError } = await createAdminClient()
      .from('CodexRunEvent')
      .select('id')
      .eq('runId', payload.runId)
      .eq('event', notificationEvent)
      .limit(1);
    if (eventError) throw new Error(eventError.message);
    if (existing?.length)
      return Response.json({ delivered: true, duplicate: true });
    const { data: policy, error: policyError } = await createAdminClient()
      .from('CodexRepositoryPolicy')
      .select('baseBranch')
      .eq('fullName', run.repositoryFullName ?? '')
      .maybeSingle();
    if (policyError) throw new Error(policyError.message);
    const baseBranch = policy?.baseBranch ?? 'develop';
    const content =
      payload.event === 'PR_OPENED'
        ? `🎉💅 **Botuki terminó la quest, bestie**\n\nLa PR del ticket **${ticketCode(ticket)}** ya está lista.\n\nRepositorio: **${run.repositoryFullName ?? 'seleccionado por Botuki'}**\nPull Request: ${payload.pullRequestUrl ?? run.pullRequestUrl}${executionCost ? `\n\nCosto estimado de ejecución: **${executionCost}**` : ''}\n\nLa PR apunta a \`develop\`. Revisa CI y cambios antes del merge. ✨`
        : `💥 **Botuki encontró un plot twist en la quest**\n\nLa implementación del ticket **${ticketCode(ticket)}** falló.\n\n${payload.error ?? 'Revisa los detalles de la ejecución.'}\n\nSi la ejecución es reintentable, usa \`/botuki retry\`. 🧯`;
    const { error: outboxError } = await createAdminClient()
      .from('TicketSyncOutbox')
      .insert({
        ticketPublicId: ticket.publicId,
        type: 'SEND_THREAD_MESSAGE',
        payload: {
          threadId: ticket.discordThreadId,
          content,
          ...(payload.event === 'PR_OPENED' ? { notifyPlatform: true } : {}),
        },
      });
    if (outboxError) throw new Error(outboxError.message);
    const { error: eventInsertError } = await createAdminClient()
      .from('CodexRunEvent')
      .insert({
        runId: payload.runId,
        event: notificationEvent,
        details: { threadId: ticket.discordThreadId },
      });
    if (eventInsertError) throw new Error(eventInsertError.message);
    await processOutboxJobs(5);
    return Response.json({ delivered: true });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Invalid event' },
      { status: 400 },
    );
  }
}
