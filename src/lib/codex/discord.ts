import {
  InteractionResponseFlags,
  InteractionResponseType,
} from 'discord-interactions';
import { callbackInteraction, followupInteraction } from '@/lib/discord/client';
import { interactionActor } from '@/lib/discord/interactions';
import { canAnalyzeWithCodex } from '@/lib/codex/authorization';
import {
  cancelCodexRun,
  approveCodexAnalysis,
  getLatestCodexAnalysis,
  getLatestCodexRun,
  getCodexRunUsage,
  answerCodexQuestion,
  requestCodexAnalysis,
  retryCodexImplementation,
  startCodexImplementation,
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

function usageText(
  usage: Array<{
    phase: string;
    inputTokens: number;
    cachedInputTokens: number;
    outputTokens: number;
    reasoningOutputTokens: number;
    totalTokens: number;
  }>,
) {
  if (!usage.length)
    return 'Botuki todavía no tiene consumo registrado para esta ejecución.';
  const total = usage.reduce(
    (sum, item) => ({
      inputTokens: sum.inputTokens + item.inputTokens,
      cachedInputTokens: sum.cachedInputTokens + item.cachedInputTokens,
      outputTokens: sum.outputTokens + item.outputTokens,
      reasoningOutputTokens:
        sum.reasoningOutputTokens + item.reasoningOutputTokens,
      totalTokens: sum.totalTokens + item.totalTokens,
    }),
    {
      inputTokens: 0,
      cachedInputTokens: 0,
      outputTokens: 0,
      reasoningOutputTokens: 0,
      totalTokens: 0,
    },
  );
  const phases = usage
    .map((item) => `${item.phase}: ${item.totalTokens.toLocaleString('en-US')}`)
    .join(' · ');
  return [
    `Consumo de Botuki: **${total.totalTokens.toLocaleString('en-US')} tokens**.`,
    `Input: ${total.inputTokens.toLocaleString('en-US')} · Cached input: ${total.cachedInputTokens.toLocaleString('en-US')} · Output: ${total.outputTokens.toLocaleString('en-US')} · Reasoning: ${total.reasoningOutputTokens.toLocaleString('en-US')}.`,
    `Por fase: ${phases}.`,
  ].join('\n');
}

export async function handleCodexCommand(
  interaction: DiscordInteraction,
  subcommand: string | null,
) {
  if (!subcommand)
    return Response.json(
      ephemeral(
        'Usa `/codex analyze`, `/codex answer`, `/codex approve`, `/codex status`, `/codex usage`, `/codex stop`, `/codex implement` o `/codex retry`.',
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
        `✅ Implementación encolada para **${ticket.title}**. Repositorio: **${queued.analysis.selectedRepository}**. Botuki actualizará este hilo cuando abra la PR.`,
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Error inesperado';
      await followup(
        interaction,
        `No fue posible iniciar la implementación: ${errorMessage}`,
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
        `♻️ Reintento encolado para **${ticket.title}** usando el análisis aprobado. Intento: **${retried.run.attemptNumber}**. Repositorio: **${retried.analysis.selectedRepository}**.`,
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Error inesperado';
      await followup(
        interaction,
        `No fue posible reintentar la implementación: ${errorMessage}`,
        true,
      );
    }
    return new Response(null, { status: 202 });
  }

  if (subcommand === 'approve') {
    await acknowledge(interaction);
    if (!(await recordOnce(interaction)))
      return new Response(null, { status: 202 });
    try {
      const approved = await approveCodexAnalysis(ticket, actor.id);
      await followup(
        interaction,
        `Análisis aprobado para **${ticket.title}**. ${statusText(approved.run.status)}\nRepositorio autorizado: **${approved.analysis.selectedRepository}**. Ejecuta \`/codex implement\` cuando el runner esté disponible.`,
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Error inesperado';
      await followup(
        interaction,
        `No fue posible aprobar el análisis: ${errorMessage}`,
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
        `Respuesta registrada para **${ticket.title}**. ${statusText(answered.run.status)}\n${analysisText(answered.analysis)}`,
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Error inesperado';
      await followup(
        interaction,
        `No fue posible registrar la respuesta: ${errorMessage}`,
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
    if (subcommand === 'usage') {
      await followup(
        interaction,
        run
          ? usageText(await getCodexRunUsage(run.id))
          : 'Botuki aún no tiene una ejecución para este ticket.',
      );
      return new Response(null, { status: 202 });
    }

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
