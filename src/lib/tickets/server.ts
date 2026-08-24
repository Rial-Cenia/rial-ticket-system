import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import type { CreateTicketInput, UpdateTicketInput } from '@/lib/schemas';
import type { ActivitySource, Ticket, TicketFilters } from '@/lib/types';

interface Actor {
  id: string | null;
  name: string;
  discordId?: string | null;
}

function unwrapTicket(
  data: unknown,
  error: { message: string } | null,
): Ticket {
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Ticket not found');
  return data as Ticket;
}

export async function listTickets(filters: TicketFilters = {}) {
  const admin = createAdminClient();
  let query = admin
    .from('Ticket')
    .select('*')
    .order('updatedAt', { ascending: false });

  if (filters.status) query = query.eq('status', filters.status);
  if (filters.type) query = query.eq('type', filters.type);
  if (filters.unassignedOnly || filters.platform === 'UNASSIGNED')
    query = query.is('platform', null);
  else if (filters.platform) query = query.eq('platform', filters.platform);
  if (filters.search) {
    const search = filters.search.replace(/[,%()]/g, ' ').trim();
    if (search) {
      query = query.or(
        `title.ilike.%${search}%,description.ilike.%${search}%,createdByName.ilike.%${search}%`,
      );
    }
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as Ticket[];
}

export async function getTicket(publicId: string) {
  const { data, error } = await createAdminClient()
    .from('Ticket')
    .select('*')
    .eq('publicId', publicId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as Ticket | null;
}

export async function createTicket(
  input: CreateTicketInput,
  source: ActivitySource,
  actor: Actor,
) {
  const { data, error } = await createAdminClient().rpc('create_ticket', {
    p_title: input.title,
    p_description: input.description,
    p_type: input.type ?? 'REQUERIMIENTO',
    p_platform: input.platform ?? null,
    p_source: source,
    p_actor_name: actor.name,
    p_actor_id: actor.id,
    p_discord_id: actor.discordId ?? null,
  });
  return unwrapTicket(data, error);
}

export async function updateTicket(
  publicId: string,
  patch: UpdateTicketInput,
  source: ActivitySource,
  actor: Actor,
) {
  const { data, error } = await createAdminClient().rpc('update_ticket', {
    p_public_id: publicId,
    p_patch: patch,
    p_source: source,
    p_actor_name: actor.name,
    p_actor_id: actor.id,
  });
  return unwrapTicket(data, error);
}

export async function deleteTicket(publicId: string, actor: Actor) {
  const { data, error } = await createAdminClient().rpc('delete_ticket', {
    p_public_id: publicId,
    p_source: 'WEB',
    p_actor_name: actor.name,
    p_actor_id: actor.id,
  });
  return unwrapTicket(data, error);
}
