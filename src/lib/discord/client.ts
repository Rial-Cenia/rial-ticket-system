import 'server-only';
import { getDiscordEnv } from '@/lib/env/server';
import type { DiscordMessagePayload, DiscordThread } from '@/lib/discord/types';

const API = 'https://discord.com/api/v10';

export class DiscordApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly retryAfterSeconds?: number,
  ) {
    super(message);
  }
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  useBotAuth = true,
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('content-type', 'application/json');
  if (useBotAuth)
    headers.set('authorization', `Bot ${getDiscordEnv().botToken}`);

  const response = await fetch(`${API}${path}`, {
    ...init,
    headers,
    cache: 'no-store',
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      message?: string;
      retry_after?: number;
    } | null;
    throw new DiscordApiError(
      body?.message ?? `Discord respondió ${response.status}`,
      response.status,
      body?.retry_after,
    );
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export function createPublicThread(name: string) {
  const { triageChannelId } = getDiscordEnv();
  return request<DiscordThread>(`/channels/${triageChannelId}/threads`, {
    method: 'POST',
    body: JSON.stringify({
      name: name.slice(0, 100),
      type: 11,
      auto_archive_duration: 10080,
    }),
  });
}

export async function findTicketThread(name: string) {
  const { guildId, triageChannelId } = getDiscordEnv();
  const active = await request<{ threads: DiscordThread[] }>(
    `/guilds/${guildId}/threads/active`,
  );
  const activeMatch = active.threads.find(
    (thread) => thread.parent_id === triageChannelId && thread.name === name,
  );
  if (activeMatch) return activeMatch;

  const archived = await request<{ threads: DiscordThread[] }>(
    `/channels/${triageChannelId}/threads/archived/public?limit=100`,
  );
  return archived.threads.find((thread) => thread.name === name) ?? null;
}

export function sendThreadMessage(
  threadId: string,
  payload: DiscordMessagePayload,
) {
  return request<{ id: string }>(`/channels/${threadId}/messages`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function hasTicketMessage(threadId: string, publicId: string) {
  const messages = await request<
    Array<{ embeds?: Array<{ footer?: { text?: string } }> }>
  >(`/channels/${threadId}/messages?limit=20`);
  return messages.some((message) =>
    message.embeds?.some(
      (embed) => embed.footer?.text === `rial-ticket:${publicId}`,
    ),
  );
}

export function archiveThread(threadId: string) {
  return request<DiscordThread>(`/channels/${threadId}`, {
    method: 'PATCH',
    body: JSON.stringify({ archived: true, locked: true }),
  });
}

export function renameThread(threadId: string, name: string) {
  return request<DiscordThread>(`/channels/${threadId}`, {
    method: 'PATCH',
    body: JSON.stringify({ name: name.slice(0, 100) }),
  });
}

export function callbackInteraction(
  interactionId: string,
  token: string,
  payload: unknown,
) {
  return request(
    `/interactions/${interactionId}/${token}/callback`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
    false,
  );
}

export function editInteractionResponse(
  applicationId: string,
  token: string,
  payload: DiscordMessagePayload,
) {
  return request(
    `/webhooks/${applicationId}/${token}/messages/@original`,
    {
      method: 'PATCH',
      body: JSON.stringify(payload),
    },
    false,
  );
}

export function followupInteraction(
  applicationId: string,
  token: string,
  payload: DiscordMessagePayload,
) {
  return request(
    `/webhooks/${applicationId}/${token}`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
    false,
  );
}

export function createOrUpdatePanel(
  payload: DiscordMessagePayload,
  messageId?: string,
) {
  const { triageChannelId } = getDiscordEnv();
  const path = messageId
    ? `/channels/${triageChannelId}/messages/${messageId}`
    : `/channels/${triageChannelId}/messages`;
  return request<{ id: string }>(path, {
    method: messageId ? 'PATCH' : 'POST',
    body: JSON.stringify(payload),
  });
}
