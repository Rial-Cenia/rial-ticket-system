import {
  createTicketSchema,
  platformSchema,
  ticketStatusSchema,
} from '@/lib/schemas';
import type { DiscordInteraction } from '@/lib/discord/types';

export function interactionActor(interaction: DiscordInteraction) {
  const user = interaction.member?.user ?? interaction.user;
  if (!user) throw new Error('Discord no incluyó el usuario de la interacción');
  return {
    id: user.id,
    name: interaction.member?.nick ?? user.global_name ?? user.username,
    roles: interaction.member?.roles ?? [],
  };
}

function findValue(node: unknown, customId: string): string | undefined {
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findValue(item, customId);
      if (found) return found;
    }
    return undefined;
  }
  if (!node || typeof node !== 'object') return undefined;
  const record = node as Record<string, unknown>;
  if (record.custom_id === customId) {
    if (typeof record.value === 'string') return record.value;
    if (Array.isArray(record.values) && typeof record.values[0] === 'string')
      return record.values[0];
  }

  for (const key of ['components', 'component']) {
    const child = record[key];
    if (Array.isArray(child)) {
      for (const item of child) {
        const found = findValue(item, customId);
        if (found) return found;
      }
    } else {
      const found = findValue(child, customId);
      if (found) return found;
    }
  }
  return undefined;
}

export function parseTicketModal(interaction: DiscordInteraction) {
  return createTicketSchema.parse({
    title: findValue(interaction.data?.components, 'ticket_title'),
    description: findValue(interaction.data?.components, 'ticket_description'),
    type: findValue(interaction.data?.components, 'ticket_type'),
  });
}

export function parseTriageId(customId: string) {
  const match =
    /^triage_platform_([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i.exec(
      customId,
    );
  return match?.[1] ?? null;
}

export function parseStatusId(customId: string) {
  const match =
    /^status_(EN_PROGRESO|EN_ESPERA|RESUELTO)_([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i.exec(
      customId,
    );
  if (!match) return null;
  const parsed = ticketStatusSchema.parse(match[1]);
  if (parsed === 'PENDIENTE') return null;
  return { status: parsed, publicId: match[2] };
}

export function selectedPlatform(interaction: DiscordInteraction) {
  return platformSchema.parse(interaction.data?.values?.[0]);
}
