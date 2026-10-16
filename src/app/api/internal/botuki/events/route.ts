import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { processOutboxJobs } from '@/lib/discord/jobs';
import { getBotukiEnv } from '@/lib/env/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTicket } from '@/lib/tickets/server';
import { ticketCode } from '@/lib/tickets/format';

const eventSchema = z.object({
  runId: z.string().uuid(),
  event: z.enum(['PR_OPENED', 'IMPLEMENTATION_FAILED']),
  pullRequestUrl: z.string().url().optional(),
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
    const ticket = await getTicket(run.ticketPublicId as string);
    if (!ticket?.discordThreadId)
      return Response.json({
        delivered: false,
        reason: 'ticket_thread_missing',
      });
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
    const content =
      payload.event === 'PR_OPENED'
        ? `🎉💅 **Botuki terminó la quest, bestie**\n\nLa PR del ticket **${ticketCode(ticket)}** ya está lista.\n\nRepositorio: **${run.repositoryFullName ?? 'seleccionado por Botuki'}**\nPull Request: ${payload.pullRequestUrl ?? run.pullRequestUrl}\n\nLa PR apunta a \`develop\`. Revisa CI y cambios antes del merge. ✨`
        : `💥 **Botuki encontró un plot twist en la quest**\n\nLa implementación del ticket **${ticketCode(ticket)}** falló.\n\n${payload.error ?? 'Revisa los detalles de la ejecución.'}\n\nSi la ejecución es reintentable, usa \`/botuki retry\`. 🧯`;
    const { error: outboxError } = await createAdminClient()
      .from('TicketSyncOutbox')
      .insert({
        ticketPublicId: ticket.publicId,
        type: 'SEND_THREAD_MESSAGE',
        payload: { threadId: ticket.discordThreadId, content },
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
