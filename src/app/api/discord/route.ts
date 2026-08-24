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
  ticketControls,
} from '@/lib/discord/components';
import {
  callbackInteraction,
  editInteractionResponse,
  followupInteraction,
} from '@/lib/discord/client';
import {
  interactionActor,
  parseStatusId,
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
import { createTicket, getTicket, updateTicket } from '@/lib/tickets/server';

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
    );
    const dispatch = await processOutboxJobs(5).catch(() => null);
    const suffix = dispatch?.delivered
      ? ' El thread de triage ya está disponible.'
      : ' El thread quedó en cola de sincronización.';
    await editInteractionResponse(
      interaction.application_id,
      interaction.token,
      {
        content: `✅ Ticket **${ticket.title}** creado con ID \`${ticket.publicId}\`.${suffix}`,
        allowed_mentions: { parse: [] },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error inesperado';
    await editInteractionResponse(
      interaction.application_id,
      interaction.token,
      {
        content: `❌ No fue posible crear el ticket: ${message}`,
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
      ephemeral('Solo Barbilla Roja puede asignar la plataforma.'),
    );

  await acknowledge(
    interaction,
    InteractionResponseType.DEFERRED_UPDATE_MESSAGE,
  );
  if (!(await recordOnce(interaction)))
    return new Response(null, { status: 202 });

  try {
    const platform = selectedPlatform(interaction);
    const ticket = await updateTicket(
      publicId,
      { platform, status: 'EN_PROGRESO' },
      'DISCORD',
      actor,
    );
    await editInteractionResponse(
      interaction.application_id,
      interaction.token,
      ticketControls(ticket, actor.name, platformRoleId(platform)),
    );
    await processOutboxJobs(5).catch(() => null);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error inesperado';
    await followupInteraction(interaction.application_id, interaction.token, {
      content: `❌ No fue posible asignar el ticket: ${message}`,
      flags: InteractionResponseFlags.EPHEMERAL,
      allowed_mentions: { parse: [] },
    });
  }
  return new Response(null, { status: 202 });
}

async function handleStatus(
  interaction: DiscordInteraction,
  publicId: string,
  status: 'EN_PROGRESO' | 'EN_ESPERA' | 'RESUELTO',
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
    if (!current) throw new Error('Ticket not found');
    if (!current.platform)
      throw new Error('El ticket todavía no tiene plataforma');
    const env = getDiscordEnv();
    const allowed = canChangeTicketStatus(
      actor.roles,
      env.triagerRoleId,
      platformRoleId(current.platform),
    );
    if (!allowed) {
      await followupInteraction(interaction.application_id, interaction.token, {
        content: 'No tienes permisos para cambiar el estado de este ticket.',
        flags: InteractionResponseFlags.EPHEMERAL,
        allowed_mentions: { parse: [] },
      });
      return new Response(null, { status: 202 });
    }

    const ticket = await updateTicket(publicId, { status }, 'DISCORD', actor);
    await editInteractionResponse(
      interaction.application_id,
      interaction.token,
      ticketControls(ticket, actor.name, platformRoleId(ticket.platform!)),
    );
    await followupInteraction(interaction.application_id, interaction.token, {
      content: `📝 Estado: **${current.status}** → **${ticket.status}** · ${actor.name} · ${new Date().toISOString()}`,
      allowed_mentions: { parse: [] },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error inesperado';
    await followupInteraction(interaction.application_id, interaction.token, {
      content: `❌ No fue posible cambiar el estado: ${message}`,
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
      ephemeral('Este bot no está habilitado en este servidor.'),
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

  return Response.json(ephemeral('Interacción no soportada.'));
}
