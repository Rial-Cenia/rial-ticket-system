import {
  InteractionResponseFlags,
  InteractionResponseType,
  InteractionType,
} from 'discord-interactions';
import { canChangeTicketStatus, canTriage } from '@/lib/discord/authorization';
import {
  createTicketModal,
  CREATE_TICKET_MODAL_ID,
  OPEN_TICKET_MODAL_ID,
  statusUpdateMessage,
  ticketControls,
} from '@/lib/discord/components';
import {
  archiveThread,
  callbackInteraction,
  editInteractionResponse,
  followupInteraction,
} from '@/lib/discord/client';
import {
  interactionActor,
  parseStatusId,
  parseTicketAttachments,
  parseTicketModal,
  parseTriageId,
  selectedPlatform,
} from '@/lib/discord/interactions';
import { platformRoleId } from '@/lib/discord/roles';
import { verifyDiscordRequest } from '@/lib/discord/signature';
import { processOutboxJobs } from '@/lib/discord/jobs';
import {
  discordInteractionSchema,
  type DiscordInteraction,
} from '@/lib/discord/types';
import { getDiscordEnv } from '@/lib/env/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  createTicket,
  getTicket,
  getTicketImageSignedUrls,
  updateTicket,
} from '@/lib/tickets/server';
import { ticketCode } from '@/lib/tickets/format';
import {
  PLATFORM_LABELS,
  STATUS_LABELS,
  type Ticket,
  type TicketStatus,
} from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ephemeral = (content: string) => ({
  type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
  data: {
    content,
    flags: InteractionResponseFlags.EPHEMERAL,
    allowed_mentions: { parse: [] },
  },
});

function creatorUpdate(ticket: Ticket, content: string) {
  const creatorId = ticket.createdByDiscordId;
  return {
    content: creatorId ? `<@${creatorId}> ${content}` : content,
    allowed_mentions: {
      parse: [],
      ...(creatorId ? { users: [creatorId] } : {}),
    },
  };
}

async function acknowledge(interaction: DiscordInteraction, type: number) {
  await callbackInteraction(interaction.id, interaction.token, { type });
}

async function recordOnce(interaction: DiscordInteraction) {
  const { data, error } = await createAdminClient().rpc(
    'record_discord_interaction',
    {
      p_id: interaction.id,
      p_type: interaction.type,
    },
  );
  if (error) throw new Error(error.message);
  return data === true;
}

async function handleModal(interaction: DiscordInteraction) {
  await callbackInteraction(interaction.id, interaction.token, {
    type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
    data: { flags: InteractionResponseFlags.EPHEMERAL },
  });

  if (!(await recordOnce(interaction)))
    return new Response(null, { status: 202 });
  try {
    const actor = interactionActor(interaction);
    const ticket = await createTicket(
      parseTicketModal(interaction),
      'DISCORD',
      {
        id: actor.id,
        name: actor.name,
        discordId: actor.id,
      },
      parseTicketAttachments(interaction),
    );
    const dispatch = await processOutboxJobs(5).catch(() => null);
    const suffix = dispatch?.delivered
      ? 'El hilo ya está disponible para soltar todo el chisme y resolver el problemita, uwu ʕ•́ᴥ•̀ʔっ♡'
      : `🧵✨ **El hilito entró en la fila de sincronización**
Está esperando su turno muy educadamente, bestie (˶ᵔ ᵕ ᵔ˶)🎀
En cuanto le toque, hará *sync* y quedará todo divino, uwu 💅🏻`;
    await editInteractionResponse(
      interaction.application_id,
      interaction.token,
      {
        content: `✅ ¡Ticket **${ticket.title}** creado, bestie! ദ്ദി(˵ •̀ ᴗ - ˵ ) ✧
Tu codiguito es \`${ticketCode(ticket)}\` 🎟️💕
${suffix}
Ahora toca esperar a que el team haga su magia y sirva soporte 💅✨
Ticket creado = momento slay. Cero bugs, pura gestión 🎀`,
        allowed_mentions: { parse: [] },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error inesperado';
    await editInteractionResponse(
      interaction.application_id,
      interaction.token,
      {
        content: `❌ **Uy, bestie… el ticket no quiso cooperar** (╥﹏╥)💔
No fue posible crearlo por este dramita técnico: \`${message}\` 🛠️
Inténtalo otra vez en un momentito. Si sigue fallando, habrá que invocar al team técnico antes de que esto se convierta en tremendo evento canónico, uwu 🕯️✨`,
        allowed_mentions: { parse: [] },
      },
    );
  }
  return new Response(null, { status: 202 });
}

async function handleTriage(interaction: DiscordInteraction, publicId: string) {
  const actor = interactionActor(interaction);
  const env = getDiscordEnv();
  if (!canTriage(actor.roles, env.triagerRoleId))
    return Response.json(
      ephemeral(`🚫 **Alto ahí, bestie** ✋(˵ •̀ ᴗ •́ ˵ )
Solo **Barbilla Roja 👹** tiene el poder ancestral para asignar la plataforma 🔮✨
El resto somos simples mortales sin esos permisos, uwu. Toca invocarlo y esperar que responda al llamado 📣🕯️`),
    );

  await acknowledge(
    interaction,
    InteractionResponseType.DEFERRED_UPDATE_MESSAGE,
  );
  if (!(await recordOnce(interaction)))
    return new Response(null, { status: 202 });

  try {
    const platform = selectedPlatform(interaction);
    const ticket = await updateTicket(publicId, { platform }, 'DISCORD', actor);
    const imageUrls = await getTicketImageSignedUrls(publicId);
    const platformLabel = PLATFORM_LABELS[ticket.platform!];
    await editInteractionResponse(
      interaction.application_id,
      interaction.token,
      ticketControls(ticket, actor.name, platformRoleId(platform), imageUrls),
    );
    await followupInteraction(
      interaction.application_id,
      interaction.token,
      creatorUpdate(
        ticket,
        `🎀 Plot twist administrativo 🎀
El ticket \`${ticketCode(ticket)}\` encontró a su humano designado: **${platformLabel}** (づ｡◕‿‿◕｡)づ📋
Por ahora sigue en estado **${STATUS_LABELS[ticket.status]}** ⏳
O sea, ya tiene dueño… pero la quest todavía no comienza, uwu 🎮✨
**${platformLabel}**, te tocó cocinar, bestie 👨‍🍳🔥`,
      ),
    );
    await processOutboxJobs(5).catch(() => null);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error inesperado';
    await followupInteraction(interaction.application_id, interaction.token, {
      content: `❌ **La asignación no pasó el vibe check** (｡•́︿•̀｡)💔
No fue posible asignar el ticket por el siguiente dramita: \`${message}\` 🛠️
Revisa los datos e inténtalo nuevamente, bestie. El ticket sigue esperando a su persona elegida 👉👈🎟️✨`,
      flags: InteractionResponseFlags.EPHEMERAL,
      allowed_mentions: { parse: [] },
    });
  }
  return new Response(null, { status: 202 });
}

async function handleStatus(
  interaction: DiscordInteraction,
  publicId: string,
  status: TicketStatus,
) {
  await acknowledge(
    interaction,
    InteractionResponseType.DEFERRED_UPDATE_MESSAGE,
  );
  if (!(await recordOnce(interaction)))
    return new Response(null, { status: 202 });

  try {
    const actor = interactionActor(interaction);
    const current = await getTicket(publicId);
    if (!current)
      throw new Error(`🔍💔 **Bestie… ese ticket no existe en este plano astral**
No pudimos encontrarlo por ningún lado (｡•́︿•̀｡)
Revisa el código e inténtalo otra vez, porque parece que hizo *ghosting*, uwu 👻🎀`);
    if (!current.platform)
      throw new Error(`🫣 **Bestie, aquí falta un detallito importante…**
El ticket todavía no tiene una **plataforma** asignada (｡•́︿•̀｡)💻
Primero hay que ponerle una, porque enviarlo así sería soltarlo al mundo sin contexto ni supervisión parental, uwu 🎀✨`);
    const env = getDiscordEnv();
    const allowed = canChangeTicketStatus(
      actor.roles,
      env.triagerRoleId,
      platformRoleId(current.platform),
    );
    if (!allowed) {
      await followupInteraction(interaction.application_id, interaction.token, {
        content: `🚨 **Amix, ese botoncito no es para ti** ( •́ ᴖ •̀ )💔
No tienes los permisos necesarios para cambiar el estado de este ticket 🔒✨
Toca invocar a alguien con más aura administrativa, porque el sistema te dijo: **“hasta aquí llegaste, bestie”**, uwu 🫵🏻🎀`,
        flags: InteractionResponseFlags.EPHEMERAL,
        allowed_mentions: { parse: [] },
      });
      return new Response(null, { status: 202 });
    }

    const ticket = await updateTicket(publicId, { status }, 'DISCORD', actor);
    const imageUrls = await getTicketImageSignedUrls(publicId);
    await editInteractionResponse(
      interaction.application_id,
      interaction.token,
      ticketControls(
        ticket,
        actor.name,
        platformRoleId(ticket.platform!),
        imageUrls,
      ),
    );
    await followupInteraction(interaction.application_id, interaction.token, {
      ...creatorUpdate(ticket, statusUpdateMessage(ticket, actor.name)),
    });
    if (status === 'RESUELTO' && ticket.discordThreadId)
      await archiveThread(ticket.discordThreadId);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error inesperado';
    await followupInteraction(interaction.application_id, interaction.token, {
      content: `❌ **El cambio de estado hizo flop, bestie** (╥﹏╥)💥
No fue posible actualizarlo por este pequeño escándalo técnico: \`${message}\` 🛠️🎀
Inténtalo nuevamente cuando los astros del Kanban estén alineados, uwu 🕯️✨`,
      flags: InteractionResponseFlags.EPHEMERAL,
      allowed_mentions: { parse: [] },
    });
  }
  return new Response(null, { status: 202 });
}

export async function POST(request: Request) {
  // Discord exige verificar la firma contra el body crudo antes de deserializarlo.
  const rawBody = await request.text();
  const publicKey = getDiscordEnv().publicKey;

  if (!(await verifyDiscordRequest(rawBody, request.headers, publicKey))) {
    return Response.json({ error: 'Firma inválida' }, { status: 401 });
  }

  let interaction: DiscordInteraction;
  try {
    interaction = discordInteractionSchema.parse(JSON.parse(rawBody));
  } catch {
    return Response.json({ error: 'Payload inválido' }, { status: 400 });
  }

  if (interaction.type === InteractionType.PING)
    return Response.json({ type: InteractionResponseType.PONG });

  const env = getDiscordEnv();
  if (interaction.guild_id !== env.guildId)
    return Response.json(
      ephemeral(`🤖💤 **Este bot no vive aquí, bestie…**
No está habilitado en este servidor (｡•́︿•̀｡)💔
Toca activarlo antes de invocarlo, porque por ahora está en modo fantasma: cero presencia, cero servicio, cero aura administrativa 👻🎀`),
    );

  if (
    interaction.type === InteractionType.MESSAGE_COMPONENT &&
    interaction.data?.custom_id === OPEN_TICKET_MODAL_ID
  ) {
    return Response.json(createTicketModal());
  }

  if (
    interaction.type === InteractionType.MODAL_SUBMIT &&
    interaction.data?.custom_id === CREATE_TICKET_MODAL_ID
  ) {
    return handleModal(interaction);
  }

  if (
    interaction.type === InteractionType.MESSAGE_COMPONENT &&
    interaction.data?.custom_id
  ) {
    const triageId = parseTriageId(interaction.data.custom_id);
    if (triageId) return handleTriage(interaction, triageId);
    const parsedStatus = parseStatusId(interaction.data.custom_id);
    if (parsedStatus)
      return handleStatus(
        interaction,
        parsedStatus.publicId,
        parsedStatus.status,
      );
  }

  return Response.json(
    ephemeral(`🚫🎮 **Esa interacción todavía no está desbloqueada, bestie**
El bot no sabe qué hacer con ella y quedó en modo confundido (⊙_⊙;)💭
Prueba otra opción antes de que tenga una crisis existencial digital, uwu 🤖🎀`),
  );
}
