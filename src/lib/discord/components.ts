import type { DiscordMessagePayload } from '@/lib/discord/types';
import {
  PLATFORM_LABELS,
  PLATFORMS,
  STATUS_LABELS,
  TICKET_TYPES,
  TYPE_LABELS,
  type Platform,
  type Ticket,
} from '@/lib/types';
import { ticketCode } from '@/lib/tickets/format';

export const OPEN_TICKET_MODAL_ID = 'open_ticket_modal';
export const CREATE_TICKET_MODAL_ID = 'create_ticket_modal';

function sanitize(value: string) {
  return value.replaceAll('@', '@\u200b').slice(0, 4000);
}

export function ticketPanelMessage(): DiscordMessagePayload {
  return {
    content:
      '## Ticketera Rial\n¿Necesitas soporte? Presiona el botón para crear un ticket.',
    components: [
      {
        type: 1,
        components: [
          {
            type: 2,
            style: 1,
            label: 'Crear ticket',
            custom_id: OPEN_TICKET_MODAL_ID,
            emoji: { name: '🎫' },
          },
        ],
      },
    ],
    allowed_mentions: { parse: [] },
  };
}

export function createTicketModal() {
  return {
    type: 9,
    data: {
      custom_id: CREATE_TICKET_MODAL_ID,
      title: 'Crear ticket de soporte',
      components: [
        {
          type: 18,
          label: 'Título',
          component: {
            type: 4,
            custom_id: 'ticket_title',
            style: 1,
            required: true,
            max_length: 200,
          },
        },
        {
          type: 18,
          label: 'Descripción',
          component: {
            type: 4,
            custom_id: 'ticket_description',
            style: 2,
            required: true,
            max_length: 4000,
          },
        },
        {
          type: 18,
          label: 'Tipo de ticket',
          component: {
            type: 3,
            custom_id: 'ticket_type',
            required: true,
            options: TICKET_TYPES.map((type) => ({
              label: TYPE_LABELS[type],
              value: type,
            })),
          },
        },
      ],
    },
  };
}

export function triageMessage(
  ticket: Ticket,
  triagerRoleId: string,
): DiscordMessagePayload {
  return {
    content: `<@&${triagerRoleId}> nuevo ticket pendiente de triage.`,
    embeds: [
      {
        title: sanitize(ticket.title),
        description: sanitize(ticket.description),
        color: 0x407db7,
        fields: [
          { name: 'Código', value: ticketCode(ticket), inline: false },
          { name: 'Tipo', value: TYPE_LABELS[ticket.type], inline: true },
          { name: 'Estado', value: STATUS_LABELS[ticket.status], inline: true },
          {
            name: 'Creador',
            value: sanitize(ticket.createdByName),
            inline: true,
          },
        ],
        footer: { text: `rial-ticket:${ticket.publicId}` },
        timestamp: ticket.createdAt,
      },
    ],
    components: [
      {
        type: 1,
        components: [
          {
            type: 3,
            custom_id: `triage_platform_${ticket.publicId}`,
            placeholder: 'Asignar plataforma',
            min_values: 1,
            max_values: 1,
            options: PLATFORMS.map((platform) => ({
              label: PLATFORM_LABELS[platform],
              value: platform,
            })),
          },
        ],
      },
    ],
    allowed_mentions: { parse: [], roles: [triagerRoleId] },
  };
}

export function ticketControls(
  ticket: Ticket,
  assignedBy: string,
  platformRoleId: string,
): DiscordMessagePayload {
  return {
    content: `Asignado a **${PLATFORM_LABELS[ticket.platform as Platform]}** por **${sanitize(assignedBy)}**. <@&${platformRoleId}>`,
    embeds: [
      {
        title: sanitize(ticket.title),
        description: sanitize(ticket.description),
        color: ticket.status === 'RESUELTO' ? 0x12b76a : 0x407db7,
        fields: [
          { name: 'Código', value: ticketCode(ticket) },
          { name: 'Tipo', value: TYPE_LABELS[ticket.type], inline: true },
          { name: 'Estado', value: STATUS_LABELS[ticket.status], inline: true },
          {
            name: 'Plataforma',
            value: ticket.platform
              ? PLATFORM_LABELS[ticket.platform]
              : 'Sin asignar',
            inline: true,
          },
        ],
        footer: { text: `rial-ticket:${ticket.publicId}` },
        timestamp: ticket.updatedAt,
      },
    ],
    components: [
      {
        type: 1,
        components: [
          {
            type: 2,
            style: 2,
            label: 'Pendiente',
            custom_id: `status_PENDIENTE_${ticket.publicId}`,
            disabled: ticket.status === 'PENDIENTE',
          },
          {
            type: 2,
            style: 1,
            label: 'En progreso',
            custom_id: `status_EN_PROGRESO_${ticket.publicId}`,
            disabled: ticket.status === 'EN_PROGRESO',
          },
          {
            type: 2,
            style: 1,
            label: 'En staging',
            custom_id: `status_EN_STAGING_${ticket.publicId}`,
            disabled: ticket.status === 'EN_STAGING',
          },
          {
            type: 2,
            style: 2,
            label: 'En espera',
            custom_id: `status_EN_ESPERA_${ticket.publicId}`,
            disabled: ticket.status === 'EN_ESPERA',
          },
          {
            type: 2,
            style: 3,
            label: 'Resuelto',
            custom_id: `status_RESUELTO_${ticket.publicId}`,
            disabled: ticket.status === 'RESUELTO',
          },
        ],
      },
    ],
    allowed_mentions: { parse: [], roles: [platformRoleId] },
  };
}
