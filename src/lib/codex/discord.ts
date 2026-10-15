import {
  InteractionResponseFlags,
  InteractionResponseType,
} from 'discord-interactions';
import { callbackInteraction, followupInteraction } from '@/lib/discord/client';
import { interactionActor } from '@/lib/discord/interactions';
import { canAnalyzeWithCodex } from '@/lib/codex/authorization';
import {
  cancelCodexRun,
  getLatestCodexAnalysis,
  getLatestCodexRun,
  requestCodexAnalysis,
} from '@/lib/codex/server';
import { getBotukiEnv } from '@/lib/env/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTicketByDiscordThreadId } from '@/lib/tickets/server';
import type { DiscordInteraction } from '@/lib/discord/types';

const ephemeral = (content: string) => ({
  type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
  data: {
    content,
    flags: InteractionResponseFlags.EPHEMERAL,
    allowed_mentions: { parse: [] },
  },
});

async function acknowledge(interaction: DiscordInteraction) {
  await callbackInteraction(interaction.id, interaction.token, {
    type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
    data: { flags: InteractionResponseFlags.EPHEMERAL },
  });
}

async function followup(
  interaction: DiscordInteraction,
  content: string,
  ephemeralMessage = false,
) {
  await followupInteraction(interaction.application_id, interaction.token, {
    content,
    ...(ephemeralMessage ? { flags: InteractionResponseFlags.EPHEMERAL } : {}),
    allowed_mentions: { parse: [] },
  });
}

async function recordOnce(interaction: DiscordInteraction) {
  const { data, error } = await createAdminClient().rpc(
    'record_discord_interaction',
    { p_id: interaction.id, p_type: interaction.type },
  );
  if (error) throw new Error(error.message);
  return data === true;
}

function statusText(status: string) {
  return `Estado actual de Botuki: **${status}**.`;
}

function analysisText(analysis: {
  decision: string;
  complexity: string;
  confidence: number;
  selectedRepository: string | null;
  questions: string[];
  risks: string[];
}) {
  const repository = analysis.selectedRepository ?? 'sin repositorio seleccionado';
  const questions = analysis.questions.length
    ? `\nPreguntas: ${analysis.questions.join(' ')}`
    : '';
  const risks = analysis.risks.length
    ? `\nRiesgos: ${analysis.risks.join(' ')}`
    : '';
  return `Análisis: **${analysis.decision}** · Complejidad: **${analysis.complexity}** · Confianza: **${Math.round(analysis.confidence * 100)}%** · Repositorio: **${repository}**.${questions}${risks}`;
}

export async function handleCodexCommand(
  interaction: DiscordInteraction,
  subcommand: string | null,
) {
  if (!subcommand)
    return Response.json(
      ephemeral(
        'Usa `/codex analyze`, `/codex status`, `/codex stop`, `/codex implement` o `/codex retry`.',
      ),
    );

  const actor = interactionActor(interaction);
  const { operatorRoleId } = getBotukiEnv();
  if (!canAnalyzeWithCodex(actor.roles, operatorRoleId))
    return Response.json(
      ephemeral('🚫 No tienes el rol `Codex Operator` para usar Botuki.'),
    );

  if (!interaction.channel_id)
    return Response.json(
      ephemeral('Este comando solo funciona dentro del hilo de un ticket.'),
    );

  const ticket = await getTicketByDiscordThreadId(interaction.channel_id);
  if (!ticket)
    return Response.json(
      ephemeral('Este hilo no está vinculado a un ticket de Rial.'),
    );

  if (subcommand === 'implement')
    return Response.json(
      ephemeral(
        '🛡️ La implementación está bloqueada hasta que exista un análisis LOW elegible y aprobado.',
      ),
    );

  if (subcommand === 'retry')
    return Response.json(
      ephemeral(
        '♻️ El reintento se habilitará cuando el analizador de Botuki esté disponible.',
      ),
    );

  await acknowledge(interaction);
  if (!(await recordOnce(interaction)))
    return new Response(null, { status: 202 });
  try {
    const run = await getLatestCodexRun(ticket.publicId);
    if (subcommand === 'status') {
      const analysis = run ? await getLatestCodexAnalysis(run.id) : null;
      await followup(
        interaction,
        run
          ? `${statusText(run.status)}${analysis ? `\n${analysisText(analysis)}` : ''}`
          : 'Botuki aún no tiene una ejecución para este ticket.',
      );
      return new Response(null, { status: 202 });
    }

    if (subcommand === 'stop') {
      if (!run) {
        await followup(
          interaction,
          'No hay una ejecución activa para cancelar.',
          true,
        );
        return new Response(null, { status: 202 });
      }
      const cancelled = await cancelCodexRun(run, actor.id);
      await followup(
        interaction,
        `Ejecución cancelada. ${statusText(cancelled.status)}`,
      );
      return new Response(null, { status: 202 });
    }

    if (subcommand === 'analyze') {
      const requested = await requestCodexAnalysis(ticket, actor.id);
      await followup(
        interaction,
        `Análisis completado para **${ticket.title}**. ${statusText(requested.run.status)}\n${analysisText(requested.analysis)}`,
      );
      return new Response(null, { status: 202 });
    }

    await followup(interaction, 'Subcomando de Botuki no reconocido.', true);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error inesperado';
    await followup(
      interaction,
      `No fue posible procesar Botuki: ${message}`,
      true,
    );
  }
  return new Response(null, { status: 202 });
}
