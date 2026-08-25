import type { CreateTicketInput, UpdateTicketInput } from '@/lib/schemas';
import type { DiscordConversation, Ticket, TicketFilters } from '@/lib/types';

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { 'content-type': 'application/json', ...init?.headers },
  });
  const body = (await response.json()) as { data?: T; error?: string };
  if (!response.ok || body.data === undefined)
    throw new Error(body.error ?? 'La solicitud falló');
  return body.data;
}

export function fetchTickets(filters: TicketFilters) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== false && value !== '')
      params.set(key, String(value));
  });
  return request<Ticket[]>(`/api/tickets?${params}`);
}

export function createTicket(input: CreateTicketInput) {
  return request<Ticket>('/api/tickets', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateTicket(publicId: string, patch: UpdateTicketInput) {
  return request<Ticket>(`/api/tickets/${publicId}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export function deleteTicket(publicId: string) {
  return request<Ticket>(`/api/tickets/${publicId}`, { method: 'DELETE' });
}

export function fetchDiscordConversation(publicId: string) {
  return request<DiscordConversation>(
    `/api/tickets/${publicId}/discord-conversation`,
  );
}
