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
    content: `🌸・゜゜・。。・゜゜・🌸

## 🎟️ ୨୧ Ticketera Rial ୨୧ 🎟️

¿Necesitas una ayudita, bestie? (｡•́︿•̀｡)
Tranqui, no entres en pánico ni te quedes en modo NPC 💀✨
¡El team Rial está aquí para salvar el día y servir soporte! 💅🏻

Presiona el botoncito de abajo para crear tu ticket 🎀
Cuéntanos todo el chisme con lujo de detalle y te ayudaremos lo antes posible, porque ignorarte sería tremendo red flag 🚩 y nosotros sí somos muy slay, uwu ദ്ദി(˵ •̀ ᴗ - ˵ ) ✧

### 🎫 Crear ticket, bestie ʕ•́ᴥ•̀ʔっ♡

✨ Dale clic sin miedo, que el soporte sí resuelve ✨
No ticket = no ayuda, bebé. Matemáticas básicas 💋

🌸・゜゜・。。・゜゜・🌸`,
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
      title: '🎀 Crea tu ticket, bestie',

      components: [
        {
          type: 18,
          label: '✨ Ponle un titulito',
          description: 'Un resumen cortito del dramita, uwu',
          component: {
            type: 4,
            custom_id: 'ticket_title',
            style: 1,
            required: true,
            max_length: 200,
            placeholder: 'Ej: Auxilio, explotó producción 💀',
          },
        },

        {
          type: 18,
          label: '📝 Suelta todo el chisme',
          description: 'Cuéntanos qué pasó con lujo de detalle',
          component: {
            type: 4,
            custom_id: 'ticket_description',
            style: 2,
            required: true,
            max_length: 4000,
            placeholder:
              'Danos contexto, pasos para reproducirlo y cualquier dato útil 👉👈',
          },
        },

        {
          type: 18,
          label: '🎟️ ¿Qué clase de dramita es?',
          description: 'Elige la categoría que tenga más sentido, bestie',
          component: {
            type: 3,
            custom_id: 'ticket_type',
            required: true,
            placeholder: 'Selecciona el tipo de ticket ✨',
            options: TICKET_TYPES.map((type) => ({
              label: TYPE_LABELS[type],
              value: type,
            })),
          },
        },
        {
          type: 18,
          label: '📸 Suelta las pruebas, bestie',
          description:
            'Hasta 5 fotitos de 10 MB c/u. El chisme visual ayuda, uwu',
          component: {
            type: 19,
            custom_id: 'ticket_images',
            min_values: 0,
            max_values: 5,
            required: false,
          },
        },
      ],
    },
  };
}

export function triageMessage(
  ticket: Ticket,
  triagerRoleId: string,
  imageUrls: string[] = [],
): DiscordMessagePayload {
  return {
    content: `🚨 **¡Nueva side quest desbloqueada, equipo!** 🚨

<@&${triagerRoleId}>, apareció un ticket pendiente de triage 📩✨

Necesita plataforma y un valiente que lo adopte antes de que empiece su arco de abandono (｡•́︿•̀｡)💔

Échenle una miradita y decidan su destino, besties. **El ticket no se va a triajar solo** 💅🏻🎀`,

    embeds: [
      {
        title: `🎟️ ${sanitize(ticket.title)}`,
        description: sanitize(ticket.description),
        color: 0x407db7,

        fields: [
          {
            name: '🔖 Codiguito',
            value: ticketCode(ticket),
            inline: false,
          },
          {
            name: '🧩 Tipo de dramita',
            value: TYPE_LABELS[ticket.type],
            inline: true,
          },
          {
            name: '📊 Estado actual',
            value: STATUS_LABELS[ticket.status],
            inline: true,
          },
          {
            name: '🧍 Bestie responsable',
            value: sanitize(ticket.createdByName),
            inline: true,
          },
        ],

        footer: {
          text: `rial-ticket:${ticket.publicId} • gestionando cositas, uwu`,
        },

        timestamp: ticket.createdAt,
        ...(imageUrls[0] ? { image: { url: imageUrls[0] } } : {}),
      },
      ...imageUrls.slice(1).map((url) => ({ image: { url } })),
    ],

    components: [
      {
        type: 1,

        components: [
          {
            type: 3,
            custom_id: `triage_platform_${ticket.publicId}`,
            placeholder: '✨ Elige su plataforma, bestie',
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

    allowed_mentions: {
      parse: [],
      roles: [triagerRoleId],
    },
  };
}

export function statusUpdateMessage(ticket: Ticket, actorName: string) {
  const code = ticketCode(ticket);
  const user = sanitize(actorName);
  const messages: Record<Ticket['status'], string> = {
    EN_PROGRESO: `🔄 **¡Tenemos movimiento en el Kanban!** 🛹✨
**${user}** actualizó el ticket \`${code}\` y ahora está **EN PROGRESO** 🚧
La quest ha comenzado, besties. Alguien ya se puso la 10 y está cocinando una solución, uwu 🍳🔥`,
    PENDIENTE: `⏳ **Mini pausa administrativa** (｡•́︿•̀｡)
El ticket \`${code}\` fue actualizado por **${user}** y quedó **PENDIENTE** 🎀
Todavía no entra al horno, pero ya está haciendo fila educadamente. Paciencia, bestie: su momento slay llegará 🧍✨`,
    EN_STAGING: `🧪 **¡Entramos en la era de las pruebibas!** ✨
**${user}** movió el ticket \`${code}\` a **EN STAGING** 🧑‍🔬🎀
La solución ya está en su ensayo general: probando el outfit antes de salir a producción 💃🏻
Manifestando cero bugs, uwu 🕯️ʕ•́ᴥ•̀ʔっ`,
    RESUELTO: `🎉 **¡Caso cerrado, criaturas!** 🎉
El ticket \`${code}\` fue marcado como **RESUELTO** por **${user}** ✅💖
El problema fue derrotado, la paz regresó al reino y el team sirvió desarrollo con éxito 💅🏻✨
Common support W, besties ʕっ•ᴥ•ʔっ♡`,
    EN_ESPERA: `🛑 **El ticket entró en modo “ahí te aviso”** 🧍🏻‍♀️💭
**${user}** cambió el estado de \`${code}\` a **EN ESPERA** ⏸️🎀
Por ahora toca hacer una pausita dramática y aguardar novedades…
No está olvidado, solo está teniendo su training arc, uwu 🌸✨`,
  };

  return messages[ticket.status];
}

export function ticketControls(
  ticket: Ticket,
  assignedBy: string,
  platformRoleId: string,
  imageUrls: string[] = [],
): DiscordMessagePayload {
  return {
    content: `🎮 **¡Nueva quest asignada!**

El ticket aterrizó en **${PLATFORM_LABELS[ticket.platform as Platform]}**, cortesía de **${sanitize(assignedBy)}** ✨

<@&${platformRoleId}>, les toca cocinar, besties. Demuestren esa aura resolutiva 💅🏻🔥`,

    embeds: [
      {
        title: `🎟️ ${sanitize(ticket.title)}`,
        description: sanitize(ticket.description),
        color: ticket.status === 'RESUELTO' ? 0x12b76a : 0x407db7,

        fields: [
          {
            name: '🔖 Codiguito',
            value: ticketCode(ticket),
          },
          {
            name: '🧩 Tipo de dramita',
            value: TYPE_LABELS[ticket.type],
            inline: true,
          },
          {
            name: '📊 Mood actual',
            value: STATUS_LABELS[ticket.status],
            inline: true,
          },
          {
            name: '🖥️ Plataforma elegida',
            value: ticket.platform
              ? PLATFORM_LABELS[ticket.platform]
              : 'Sin asignar todavía 👉👈',
            inline: true,
          },
        ],

        footer: {
          text: `rial-ticket:${ticket.publicId} • avanzando cositas, uwu`,
        },

        timestamp: ticket.updatedAt,
        ...(imageUrls[0] ? { image: { url: imageUrls[0] } } : {}),
      },
      ...imageUrls.slice(1).map((url) => ({ image: { url } })),
    ],

    components: [
      {
        type: 1,

        components: [
          {
            type: 2,
            style: 2,
            label: '⏳ Pendiente',
            custom_id: `status_PENDIENTE_${ticket.publicId}`,
            disabled: ticket.status === 'PENDIENTE',
          },
          {
            type: 2,
            style: 1,
            label: '🚧 En progreso',
            custom_id: `status_EN_PROGRESO_${ticket.publicId}`,
            disabled: ticket.status === 'EN_PROGRESO',
          },
          {
            type: 2,
            style: 1,
            label: '🧪 En staging',
            custom_id: `status_EN_STAGING_${ticket.publicId}`,
            disabled: ticket.status === 'EN_STAGING',
          },
          {
            type: 2,
            style: 2,
            label: '💤 En espera',
            custom_id: `status_EN_ESPERA_${ticket.publicId}`,
            disabled: ticket.status === 'EN_ESPERA',
          },
          {
            type: 2,
            style: 3,
            label: '✨ Resuelto',
            custom_id: `status_RESUELTO_${ticket.publicId}`,
            disabled: ticket.status === 'RESUELTO',
          },
        ],
      },
    ],

    allowed_mentions: {
      parse: [],
      roles: [platformRoleId],
    },
  };
}
