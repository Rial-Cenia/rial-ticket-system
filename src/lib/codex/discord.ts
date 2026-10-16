import {
  InteractionResponseFlags,
  InteractionResponseType,
} from 'discord-interactions';
import { callbackInteraction, followupInteraction } from '@/lib/discord/client';
import { interactionActor } from '@/lib/discord/interactions';
import { canAnalyzeWithCodex } from '@/lib/codex/authorization';
import {
  cancelCodexRun,
  getLatestCodexRun,
  answerCodexQuestion,
  requestCodexAnalysis,
  retryCodexImplementation,
  startCodexImplementation,
} from '@/lib/codex/server';
import { getBotukiEnv } from '@/lib/env/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTicketByDiscordThreadId } from '@/lib/tickets/server';
import { ticketCode } from '@/lib/tickets/format';
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

const sparkle = '🌸・゜゜・。。・゜゜・🌸';

function statusText(status: string) {
  return `Estado actual: **${status}**.`;
}

function analysisText(analysis: {
  decision: string;
  complexity: string;
  confidence: number;
  selectedRepository: string | null;
  questions: string[];
  risks: string[];
}) {
  const repository =
    analysis.selectedRepository ?? 'sin repositorio seleccionado';
  const questions = analysis.questions.length
    ? `\nPreguntas: ${analysis.questions.join(' ')}`
    : '';
  const risks = analysis.risks.length
    ? `\nRiesgos: ${analysis.risks.join(' ')}`
    : '';
  return `Análisis: **${analysis.decision}** · Complejidad: **${analysis.complexity}** · Confianza: **${Math.round(analysis.confidence * 100)}%** · Repositorio: **${repository}**.${questions}${risks}`;
}

function answerText(interaction: DiscordInteraction) {
  const option = interaction.data?.options?.[0];
  if (!option || typeof option !== 'object') return null;
  const nested = (option as { options?: unknown }).options;
  if (!Array.isArray(nested)) return null;
  const message = nested.find(
    (value): value is { name: string; value: string } =>
      typeof value === 'object' &&
      value !== null &&
      (value as { name?: unknown }).name === 'message' &&
      typeof (value as { value?: unknown }).value === 'string',
  );
  return message?.value.trim() || null;
}

export async function handleCodexCommand(
  interaction: DiscordInteraction,
  command: string | { subcommand: string; repository?: string } | null,
) {
  const commandObject = command && typeof command === 'object' ? command : null;
  const subcommand =
    typeof command === 'string' ? command : (commandObject?.subcommand ?? null);
  const requestedRepository = commandObject?.repository;
  if (!subcommand)
    return Response.json(
      ephemeral(
        `${sparkle}\n\n**Botuki está ready para servir, bestie** 🤖🎀\n\nUsa:\n• \`/botuki analyze\` — analiza el ticket.\n• \`/botuki answer\` — responde una duda.\n• \`/botuki implement\` — inicia la implementación.\n• \`/botuki retry\` — reintenta una ejecución fallida.\n• \`/botuki cancel\` — cancela la ejecución activa.\n\n${sparkle}`,
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

  if (subcommand === 'implement') {
    await acknowledge(interaction);
    if (!(await recordOnce(interaction)))
      return new Response(null, { status: 202 });
    try {
      const queued = await startCodexImplementation(ticket, actor.id);
      await followup(
        interaction,
        `🛠️✨ **Botuki tomó la quest, bestie**\n\nTicket: **${ticketCode(ticket)} · ${ticket.title}**\nRepositorio: **${queued.analysis.selectedRepository}**\n\nLa implementación quedó encolada en un worktree aislado. Botuki te avisará en este hilo cuando abra la PR o encuentre un bloqueo. 💅`,
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Error inesperado';
      await followup(
        interaction,
        `💥 **La implementación no pasó el vibe check**\n\n${errorMessage}`,
        true,
      );
    }
    return new Response(null, { status: 202 });
  }

  if (subcommand === 'retry') {
    await acknowledge(interaction);
    if (!(await recordOnce(interaction)))
      return new Response(null, { status: 202 });
    try {
      const retried = await retryCodexImplementation(ticket, actor.id);
      await followup(
        interaction,
        `♻️✨ **Botuki volvió al ring**\n\nTicket: **${ticketCode(ticket)} · ${ticket.title}**\nIntento: **${retried.run.attemptNumber}**\nRepositorio: **${retried.analysis.selectedRepository}**\n\nLa quest se reintentará con toda la energía slay.`,
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Error inesperado';
      await followup(
        interaction,
        `🚫 **Este retry no tiene aura suficiente**\n\n${errorMessage}`,
        true,
      );
    }
    return new Response(null, { status: 202 });
  }

  if (subcommand === 'answer') {
    const message = answerText(interaction);
    if (!message)
      return Response.json(
        ephemeral('Debes incluir una respuesta para Botuki.'),
      );
    await acknowledge(interaction);
    if (!(await recordOnce(interaction)))
      return new Response(null, { status: 202 });
    try {
      const answered = await answerCodexQuestion(
        ticket,
        actor.id,
        interaction.id,
        message,
      );
      await followup(
        interaction,
        `💬✨ **Respuesta recibida, bestie**\n\nBotuki actualizó el análisis de **${ticket.title}**.\n${statusText(answered.run.status)}\n${analysisText(answered.analysis)}`,
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Error inesperado';
      await followup(
        interaction,
        `💔 **Botuki no pudo procesar esa respuesta**\n\n${errorMessage}`,
        true,
      );
    }
    return new Response(null, { status: 202 });
  }

  await acknowledge(interaction);
  if (!(await recordOnce(interaction)))
    return new Response(null, { status: 202 });
  try {
    const run = await getLatestCodexRun(ticket.publicId);
    if (subcommand === 'cancel') {
      if (!run) {
        await followup(
          interaction,
          '🫧 **No hay una quest activa para cancelar**, bestie.',
          true,
        );
        return new Response(null, { status: 202 });
      }
      const cancelled = await cancelCodexRun(run, actor.id);
      await followup(
        interaction,
        `🛑✨ **Quest cancelada**\n\nBotuki pausó la ejecución de **${ticket.title}**. ${statusText(cancelled.status)}`,
      );
      return new Response(null, { status: 202 });
    }

    if (subcommand === 'analyze') {
      const requested = await requestCodexAnalysis(
        ticket,
        actor.id,
        requestedRepository,
      );
      const message =
        requested.run.status === 'ANALYSIS_APPROVED'
          ? `✨💅 **Análisis listo y aprobado automáticamente**\n\n${analysisText(requested.analysis)}\n\nEjecuta \`/botuki implement\` cuando quieras que Botuki cocine la solución.`
          : requested.run.status === 'WAITING_FOR_USER'
            ? `🧭 **Botuki necesita una ayudita, bestie**\n\n${analysisText(requested.analysis)}\n\nResponde con \`/botuki answer message:"..."\` para destrabar la quest.`
            : `⚠️ **Botuki detectó una quest que necesita revisión manual**\n\n${analysisText(requested.analysis)}`;
      await followup(interaction, `${message}\n\n${sparkle}`);
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
