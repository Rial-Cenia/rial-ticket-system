import 'server-only';
import { z } from 'zod';
import {
  archiveThread,
  createPublicThread,
  DiscordApiError,
  editThreadMessage,
  findTicketControlMessageId,
  findTicketThread,
  hasTicketMessage,
  renameThread,
  sendThreadMessage,
} from '@/lib/discord/client';
import { ticketControls, triageMessage } from '@/lib/discord/components';
import { getDiscordEnv } from '@/lib/env/server';
import * as discordRoles from '@/lib/discord/roles';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTicket, getTicketImageSignedUrls } from '@/lib/tickets/server';
import { ticketThreadName } from '@/lib/tickets/format';
import type { OutboxJob } from '@/lib/types';

const messageJobSchema = z.object({
  threadId: z.string(),
  content: z.string().min(1).max(2000),
  notifyTicketeraAdmins: z.boolean().optional(),
});

async function getPlatformRoleId(
  platform: Parameters<typeof discordRoles.platformRoleId>[0],
) {
  const roles = discordRoles as unknown as {
    resolvePlatformRoleId?: (value: typeof platform) => Promise<string | null>;
    platformRoleId: (value: typeof platform) => string | null;
  };
  if (Object.prototype.hasOwnProperty.call(roles, 'resolvePlatformRoleId'))
    return roles.resolvePlatformRoleId!(platform);
  return roles.platformRoleId(platform);
}
const syncControlsJobSchema = z.object({
  threadId: z.string(),
  syncControls: z.literal(true),
  assignedBy: z.string().min(1).max(4000),
});
const archiveJobSchema = messageJobSchema;

async function complete(id: string) {
  const { error } = await createAdminClient().rpc('complete_ticket_sync_job', {
    p_id: id,
  });
  if (error) throw new Error(error.message);
}

async function retry(job: OutboxJob, error: unknown) {
  const message = error instanceof Error ? error.message : 'Error desconocido';
  const retryAfter =
    error instanceof DiscordApiError ? error.retryAfterSeconds : undefined;
  const permanent =
    error instanceof DiscordApiError &&
    error.status >= 400 &&
    error.status < 500 &&
    error.status !== 429;
  const { error: rpcError } = await createAdminClient().rpc(
    'retry_ticket_sync_job',
    {
      p_id: job.id,
      p_error: message,
      p_retry_after_seconds: retryAfter ? Math.ceil(retryAfter) : null,
      p_permanent: permanent,
    },
  );
  if (rpcError) throw new Error(rpcError.message);
}

async function processCreateThread(job: OutboxJob) {
  const ticket = await getTicket(job.ticketPublicId);
  if (!ticket) return complete(job.id);

  const name = ticketThreadName(ticket);
  let thread = ticket.discordThreadId
    ? { id: ticket.discordThreadId, name: '' }
    : await findTicketThread(name);
  thread ??= await findTicketThread(`ticket-${ticket.publicId}`);
  thread ??= await createPublicThread(name);
  if (thread.name !== name) {
    thread = await renameThread(thread.id, name);
  }

  if (!ticket.discordThreadId) {
    const { error } = await createAdminClient().rpc(
      'set_ticket_discord_thread',
      {
        p_public_id: ticket.publicId,
        p_thread_id: thread.id,
      },
    );
    if (error) throw new Error(error.message);
  }

  if (!(await hasTicketMessage(thread.id, ticket.publicId))) {
    const imageUrls = await getTicketImageSignedUrls(ticket.publicId);
    await sendThreadMessage(
      thread.id,
      triageMessage(
        { ...ticket, discordThreadId: thread.id },
        getDiscordEnv().triagerRoleId,
        imageUrls,
      ),
    );
  }
  await complete(job.id);
}

async function processJob(job: OutboxJob) {
  if (job.type === 'CREATE_TRIAGE_THREAD') return processCreateThread(job);
  if (job.type === 'SEND_THREAD_MESSAGE') {
    const ticket = await getTicket(job.ticketPublicId);
    const syncControls = syncControlsJobSchema.safeParse(job.payload);
    if (syncControls.success) {
      if (!ticket?.platform) return complete(job.id);
      const messageId = await findTicketControlMessageId(
        syncControls.data.threadId,
        ticket.publicId,
      );
      if (!messageId) return complete(job.id);
      const imageUrls = await getTicketImageSignedUrls(ticket.publicId);
      await editThreadMessage(
        syncControls.data.threadId,
        messageId,
        ticketControls(
          ticket,
          syncControls.data.assignedBy,
          await getPlatformRoleId(ticket.platform),
          imageUrls,
        ),
      );
      return complete(job.id);
    }

    const payload = messageJobSchema.parse(job.payload);
    if (ticket) await renameThread(payload.threadId, ticketThreadName(ticket));
    const creatorId = ticket?.createdByDiscordId ?? null;
    const ticketeraAdminRoleId =
      payload.notifyTicketeraAdmins && ticket?.platform === 'TICKETERA'
        ? getDiscordEnv().ticketeraAdminRoleId
        : null;
    await sendThreadMessage(payload.threadId, {
      content: [
        ticketeraAdminRoleId ? `<@&${ticketeraAdminRoleId}>` : null,
        creatorId ? `<@${creatorId}>` : null,
        payload.content,
      ]
        .filter(Boolean)
        .join(' '),
      allowed_mentions: {
        parse: [],
        ...(creatorId ? { users: [creatorId] } : {}),
        ...(ticketeraAdminRoleId ? { roles: [ticketeraAdminRoleId] } : {}),
      },
    });
    return complete(job.id);
  }
  const payload = archiveJobSchema.parse(job.payload);
  await sendThreadMessage(payload.threadId, {
    content: payload.content,
    allowed_mentions: { parse: [] },
  });
  await archiveThread(payload.threadId);
  return complete(job.id);
}

export async function processOutboxJobs(limit = 10) {
  const { data, error } = await createAdminClient().rpc(
    'claim_ticket_sync_jobs',
    { p_limit: limit },
  );
  if (error) throw new Error(error.message);
  const jobs = (data ?? []) as OutboxJob[];
  let delivered = 0;

  for (const job of jobs) {
    try {
      await processJob(job);
      delivered += 1;
    } catch (jobError) {
      await retry(job, jobError);
    }
  }

  return { claimed: jobs.length, delivered, failed: jobs.length - delivered };
}
