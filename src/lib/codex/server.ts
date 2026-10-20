import 'server-only';
import { createHmac } from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { getBotukiEnv } from '@/lib/env/server';
import {
  analyzeDeterministicGuardrail,
  createAnalysisFallback,
  validateSemanticAnalysis,
} from '@/lib/codex/analyzer';
import {
  canImplementCodexAnalysis,
  canTransitionCodexRun,
  isEligibleCodexAnalysis,
} from '@/lib/codex/policy';
import type {
  CodexAnalysisResult,
  CodexRepositoryPolicy,
  CodexRunStatus,
} from '@/lib/codex/types';
import { CODEX_MAX_IMPLEMENTATION_RETRIES } from '@/lib/codex/types';
import type { Ticket } from '@/lib/types';

export interface CodexRunRecord {
  id: string;
  ticketPublicId: string;
  status: CodexRunStatus;
  repositoryFullName: string | null;
  branchName: string | null;
  pullRequestUrl: string | null;
  lastError: string | null;
  retryCount: number;
  attemptNumber: number;
  failureStage: string | null;
  failureCode: string | null;
  retryable: boolean;
  createdByDiscordId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CodexAnalysisRecord extends CodexAnalysisResult {
  id: string;
  runId: string;
  ticketTitle: string;
  ticketDescription: string;
  ticketUpdatedAt: string;
  approvedAt: string | null;
  createdAt: string;
}

export interface CodexRunUsageRecord {
  id: string;
  runId: string;
  phase: string;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  reasoningOutputTokens: number;
  totalTokens: number;
  createdAt: string;
}

interface SemanticAnalysisResponse {
  analysis: unknown;
  model: string;
  promptVersion: string;
  latencyMs: number;
  usage: {
    inputTokens: number;
    cachedInputTokens: number;
    outputTokens: number;
    reasoningOutputTokens: number;
    totalTokens: number;
  };
}

type AnalysisSource =
  'AI' | 'DETERMINISTIC_GUARDRAIL' | 'DETERMINISTIC_FALLBACK';

const ACTIVE_STATUSES: readonly CodexRunStatus[] = [
  'ANALYZING',
  'WAITING_FOR_USER',
  'ANALYSIS_APPROVED',
  'IMPLEMENTING',
  'VERIFYING',
];

function isActiveStatus(status: CodexRunStatus) {
  return ACTIVE_STATUSES.includes(status);
}

async function recordEvent(
  runId: string,
  event: string,
  actorDiscordId: string,
  details: Record<string, unknown> = {},
) {
  const { error } = await createAdminClient().from('CodexRunEvent').insert({
    runId,
    event,
    actorDiscordId,
    details,
  });
  if (error) throw new Error(error.message);
}

async function listRepositoryPolicies() {
  const { data, error } = await createAdminClient()
    .from('CodexRepositoryPolicy')
    .select(
      'fullName, provider, baseBranch, analysisEnabled, implementationEnabled, allowedPaths, forbiddenPaths, allowDependencyChanges, allowDatabaseChanges, maxChangedFiles',
    )
    .eq('analysisEnabled', true)
    .order('fullName');
  if (error) throw new Error(error.message);
  return (data ?? []) as CodexRepositoryPolicy[];
}

export async function getLatestCodexAnalysis(runId: string) {
  const { data, error } = await createAdminClient()
    .from('CodexAnalysis')
    .select(
      'id, runId, decision, complexity, confidence, ticketTitle, ticketDescription, ticketUpdatedAt, repositoryCandidates, selectedRepository, scope, checks, risks, questions, forbiddenChangesDetected, approvedAt, createdAt',
    )
    .eq('runId', runId)
    .order('createdAt', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as CodexAnalysisRecord | null) ?? null;
}

export async function getLatestCodexRun(ticketPublicId: string) {
  const { data, error } = await createAdminClient()
    .from('CodexRun')
    .select(
      'id, ticketPublicId, status, repositoryFullName, branchName, pullRequestUrl, lastError, retryCount, attemptNumber, failureStage, failureCode, retryable, createdByDiscordId, createdAt, updatedAt',
    )
    .eq('ticketPublicId', ticketPublicId)
    .order('createdAt', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as CodexRunRecord | null) ?? null;
}

export async function getCodexRunUsage(runId: string) {
  const { data, error } = await createAdminClient()
    .from('CodexRunUsage')
    .select(
      'id, runId, phase, inputTokens, cachedInputTokens, outputTokens, reasoningOutputTokens, totalTokens, createdAt',
    )
    .eq('runId', runId)
    .order('createdAt');
  if (error) throw new Error(error.message);
  return (data ?? []) as CodexRunUsageRecord[];
}

export async function requestCodexAnalysis(
  ticket: Ticket,
  actorDiscordId: string,
  requestedRepository?: string | null,
) {
  const existing = await getLatestCodexRun(ticket.publicId);
  if (existing && isActiveStatus(existing.status)) {
    const analysis = await getLatestCodexAnalysis(existing.id);
    if (analysis) return { run: existing, analysis };
    return await completeCodexAnalysis(existing, ticket, actorDiscordId);
  }

  const { data, error } = await createAdminClient()
    .from('CodexRun')
    .insert({
      ticketPublicId: ticket.publicId,
      status: 'ANALYZING',
      createdByDiscordId: actorDiscordId,
    })
    .select(
      'id, ticketPublicId, status, repositoryFullName, branchName, pullRequestUrl, lastError, retryCount, attemptNumber, failureStage, failureCode, retryable, createdByDiscordId, createdAt, updatedAt',
    )
    .single();
  if (error) throw new Error(error.message);
  const run = data as CodexRunRecord;
  await recordEvent(run.id, 'ANALYSIS_REQUESTED', actorDiscordId, {
    ticketTitle: ticket.title,
  });
  return await completeCodexAnalysis(
    run,
    ticket,
    actorDiscordId,
    requestedRepository,
  );
}

export async function answerCodexQuestion(
  ticket: Ticket,
  actorDiscordId: string,
  discordMessageId: string,
  message: string,
) {
  const trimmedMessage = message.trim();
  if (!trimmedMessage) throw new Error('La respuesta no puede estar vacía');
  if (trimmedMessage.length > 10000)
    throw new Error('La respuesta supera el límite permitido');

  const run = await getLatestCodexRun(ticket.publicId);
  if (!run) throw new Error('No hay un análisis activo para este ticket');
  if (run.status !== 'WAITING_FOR_USER')
    throw new Error(`Botuki no está esperando una respuesta (${run.status})`);
  const analysis = await getLatestCodexAnalysis(run.id);
  if (!analysis) throw new Error('No existe un análisis para responder');

  const { error } = await createAdminClient()
    .from('CodexConversationMessage')
    .insert({
      runId: run.id,
      discordMessageId,
      discordAuthorId: actorDiscordId,
      isBot: false,
      content: trimmedMessage,
    });
  if (error) throw new Error(error.message);
  await recordEvent(run.id, 'QUESTION_ANSWERED', actorDiscordId, {
    contentLength: trimmedMessage.length,
  });

  return await completeCodexAnalysis(
    run,
    {
      ...ticket,
      description: `${ticket.description}\n\nOperator clarification: ${trimmedMessage}`,
    },
    actorDiscordId,
    null,
  );
}

export async function approveCodexAnalysis(
  ticket: Ticket,
  actorDiscordId: string,
) {
  const run = await getLatestCodexRun(ticket.publicId);
  if (!run) throw new Error('No hay un análisis para aprobar');
  if (run.status !== 'WAITING_FOR_USER')
    throw new Error(`Botuki no está esperando aprobación (${run.status})`);
  const analysis = await getLatestCodexAnalysis(run.id);
  if (!analysis) throw new Error('No existe un análisis para aprobar');

  const { data: policy, error: policyError } = await createAdminClient()
    .from('CodexRepositoryPolicy')
    .select(
      'fullName, provider, baseBranch, analysisEnabled, implementationEnabled, allowedPaths, forbiddenPaths, allowDependencyChanges, allowDatabaseChanges, maxChangedFiles',
    )
    .eq('fullName', analysis.selectedRepository)
    .maybeSingle();
  if (policyError) throw new Error(policyError.message);
  if (
    !policy ||
    !canImplementCodexAnalysis(analysis, policy as CodexRepositoryPolicy)
  )
    throw new Error(
      'El análisis no es elegible para implementación automática',
    );

  const now = new Date().toISOString();
  const { data: approvedAnalysis, error: analysisError } =
    await createAdminClient()
      .from('CodexAnalysis')
      .update({ approvedAt: now })
      .eq('id', analysis.id)
      .is('approvedAt', null)
      .select(
        'id, runId, decision, complexity, confidence, ticketTitle, ticketDescription, ticketUpdatedAt, repositoryCandidates, selectedRepository, scope, checks, risks, questions, forbiddenChangesDetected, approvedAt, createdAt',
      )
      .single();
  if (analysisError) throw new Error(analysisError.message);
  const { data: approvedRun, error: runError } = await createAdminClient()
    .from('CodexRun')
    .update({
      status: 'ANALYSIS_APPROVED',
      repositoryFullName: analysis.selectedRepository,
    })
    .eq('id', run.id)
    .eq('status', 'WAITING_FOR_USER')
    .select(
      'id, ticketPublicId, status, repositoryFullName, branchName, pullRequestUrl, lastError, retryCount, attemptNumber, failureStage, failureCode, retryable, createdByDiscordId, createdAt, updatedAt',
    )
    .single();
  if (runError) throw new Error(runError.message);
  await recordEvent(run.id, 'ANALYSIS_APPROVED', actorDiscordId, {
    selectedRepository: analysis.selectedRepository,
  });
  return {
    run: approvedRun as CodexRunRecord,
    analysis: approvedAnalysis as CodexAnalysisRecord,
  };
}

export async function startCodexImplementation(
  ticket: Ticket,
  actorDiscordId: string,
) {
  const run = await getLatestCodexRun(ticket.publicId);
  if (!run) throw new Error('No hay un análisis para implementar');
  if (run.status !== 'ANALYSIS_APPROVED')
    throw new Error(
      `La implementación requiere un análisis aprobado (${run.status})`,
    );

  const analysis = await getLatestCodexAnalysis(run.id);
  if (!analysis || !analysis.selectedRepository)
    throw new Error('No existe un análisis elegible para implementar');

  const { data: policy, error: policyError } = await createAdminClient()
    .from('CodexRepositoryPolicy')
    .select(
      'fullName, provider, baseBranch, analysisEnabled, implementationEnabled, allowedPaths, forbiddenPaths, allowDependencyChanges, allowDatabaseChanges, maxChangedFiles',
    )
    .eq('fullName', analysis.selectedRepository)
    .maybeSingle();
  if (policyError) throw new Error(policyError.message);
  if (
    !policy ||
    !canImplementCodexAnalysis(analysis, policy as CodexRepositoryPolicy)
  )
    throw new Error(
      'El análisis ya no es elegible para implementación automática',
    );

  const { runnerUrl, runnerSharedSecret } = getBotukiEnv();
  if (!runnerUrl || !runnerSharedSecret)
    throw new Error('El runner de implementación no está configurado');

  const signature = createHmac('sha256', runnerSharedSecret)
    .update(run.id)
    .digest('hex');
  let response: Response;
  try {
    response = await fetch(runnerUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-botuki-runner-signature': signature,
      },
      body: JSON.stringify({ runId: run.id }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new Error('No fue posible conectar con el runner de implementación');
  }
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 300);
    throw new Error(
      `El runner rechazó la ejecución (${response.status})${detail ? `: ${detail}` : ''}`,
    );
  }

  await recordEvent(run.id, 'IMPLEMENTATION_REQUESTED', actorDiscordId, {
    selectedRepository: analysis.selectedRepository,
  });
  return { run, analysis };
}

export async function retryCodexImplementation(
  ticket: Ticket,
  actorDiscordId: string,
) {
  const run = await getLatestCodexRun(ticket.publicId);
  if (!run) throw new Error('No hay una ejecución para reintentar');
  const isLegacyImplementationFailure =
    run.failureStage === null && run.failureCode === null;
  const isKnownVerificationConfigurationFailure =
    run.failureCode === 'VERIFICATION_FAILED' &&
    (run.lastError?.includes(
      'Vitest cannot be imported in a CommonJS module',
    ) ||
      run.lastError?.includes("unknown option '--test-match=**/*.spec.ts'"));
  if (
    run.status !== 'FAILED' ||
    (!run.retryable &&
      !isLegacyImplementationFailure &&
      !isKnownVerificationConfigurationFailure)
  )
    throw new Error('La última ejecución no es reintentable');
  if (run.retryCount >= CODEX_MAX_IMPLEMENTATION_RETRIES)
    throw new Error(
      `Se alcanzó el máximo de ${CODEX_MAX_IMPLEMENTATION_RETRIES} reintentos`,
    );

  const analysis = await getLatestCodexAnalysis(run.id);
  if (!analysis || !isEligibleCodexAnalysis(analysis))
    throw new Error('El análisis elegible no está disponible para reintentar');

  const { data: policy, error: policyError } = await createAdminClient()
    .from('CodexRepositoryPolicy')
    .select(
      'fullName, provider, baseBranch, analysisEnabled, implementationEnabled, allowedPaths, forbiddenPaths, allowDependencyChanges, allowDatabaseChanges, maxChangedFiles',
    )
    .eq('fullName', analysis.selectedRepository)
    .maybeSingle();
  if (policyError) throw new Error(policyError.message);
  if (
    !policy ||
    !canImplementCodexAnalysis(analysis, policy as CodexRepositoryPolicy)
  )
    throw new Error(
      'El análisis aprobado ya no es elegible para implementación',
    );

  const updateQuery = createAdminClient()
    .from('CodexRun')
    .update({
      status: 'ANALYSIS_APPROVED',
      retryCount: run.retryCount + 1,
      attemptNumber: run.attemptNumber + 1,
      failureStage: null,
      failureCode: null,
      retryable: false,
      lastError: null,
      pullRequestUrl: null,
      branchName: null,
    })
    .eq('id', run.id)
    .eq('status', 'FAILED')
    .lt('retryCount', CODEX_MAX_IMPLEMENTATION_RETRIES);
  const { data: retriedRun, error: retryError } = await (
    isLegacyImplementationFailure
      ? updateQuery.is('failureStage', null).is('failureCode', null)
      : isKnownVerificationConfigurationFailure
        ? updateQuery
            .eq('failureCode', 'VERIFICATION_FAILED')
            .eq('retryable', false)
        : updateQuery.eq('retryable', true)
  )
    .select(
      'id, ticketPublicId, status, repositoryFullName, branchName, pullRequestUrl, lastError, retryCount, attemptNumber, failureStage, failureCode, retryable, createdByDiscordId, createdAt, updatedAt',
    )
    .single();
  if (retryError) throw new Error(retryError.message);
  await recordEvent(run.id, 'IMPLEMENTATION_RETRY_REQUESTED', actorDiscordId, {
    attemptNumber: retriedRun.attemptNumber,
    retryCount: retriedRun.retryCount,
  });
  return await startCodexImplementation(ticket, actorDiscordId);
}

async function completeCodexAnalysis(
  run: CodexRunRecord,
  ticket: Ticket,
  actorDiscordId: string,
  requestedRepository: string | null = null,
) {
  try {
    const policies = await listRepositoryPolicies();
    const guardrail = analyzeDeterministicGuardrail(
      ticket,
      policies,
      requestedRepository,
    );
    let result: CodexAnalysisResult;
    let source: AnalysisSource;
    let semanticResponse: SemanticAnalysisResponse | null = null;
    let fallbackReason: string | null = null;
    if (guardrail) {
      result = guardrail;
      source = 'DETERMINISTIC_GUARDRAIL';
    } else {
      try {
        semanticResponse = await requestSemanticAnalysis(
          run.id,
          requestedRepository,
        );
        result = validateSemanticAnalysis(
          semanticResponse.analysis,
          ticket,
          policies,
          requestedRepository,
        );
        source = 'AI';
      } catch (error) {
        fallbackReason =
          error instanceof Error
            ? error.message
            : 'Error desconocido del analizador';
        result = createAnalysisFallback(
          ticket,
          policies,
          'El análisis semántico no estuvo disponible; no se habilitó implementación automática.',
          requestedRepository,
        );
        source = 'DETERMINISTIC_FALLBACK';
      }
    }
    const { data, error } = await createAdminClient()
      .from('CodexAnalysis')
      .insert({
        runId: run.id,
        decision: result.decision,
        complexity: result.complexity,
        confidence: result.confidence,
        ticketTitle: ticket.title,
        ticketDescription: ticket.description,
        ticketUpdatedAt: ticket.updatedAt,
        repositoryCandidates: result.repositoryCandidates,
        selectedRepository: result.selectedRepository,
        scope: result.scope,
        checks: result.checks,
        risks: result.risks,
        questions: result.questions,
        forbiddenChangesDetected: result.forbiddenChangesDetected,
      })
      .select(
        'id, runId, decision, complexity, confidence, ticketTitle, ticketDescription, ticketUpdatedAt, repositoryCandidates, selectedRepository, scope, checks, risks, questions, forbiddenChangesDetected, approvedAt, createdAt',
      )
      .single();
    if (error) throw new Error(error.message);
    const invocation = {
      analysisId: data.id,
      source,
      model: semanticResponse?.model ?? null,
      promptVersion: semanticResponse?.promptVersion ?? null,
      latencyMs: semanticResponse?.latencyMs ?? null,
      fallbackReason,
      response: semanticResponse
        ? {
            analysis: semanticResponse.analysis,
            usage: semanticResponse.usage,
          }
        : {},
    };
    await createAdminClient()
      .from('CodexAnalysisInvocation')
      .insert(invocation);
    if (semanticResponse) {
      await createAdminClient()
        .from('CodexRunUsage')
        .insert({
          runId: run.id,
          phase: 'ANALYSIS',
          ...semanticResponse.usage,
        });
    }
    const selectedPolicy = policies.find(
      (policy) => policy.fullName === result.selectedRepository,
    );
    const automaticallyEligible =
      Boolean(selectedPolicy) &&
      isEligibleCodexAnalysis(result) &&
      canImplementCodexAnalysis(result, selectedPolicy!);
    const now = automaticallyEligible ? new Date().toISOString() : null;
    if (automaticallyEligible) {
      const { error: approvalError } = await createAdminClient()
        .from('CodexAnalysis')
        .update({ approvedAt: now })
        .eq('id', data.id);
      if (approvalError) throw new Error(approvalError.message);
    }
    const { data: updatedRun, error: updateError } = await createAdminClient()
      .from('CodexRun')
      .update({
        status: automaticallyEligible
          ? 'ANALYSIS_APPROVED'
          : 'WAITING_FOR_USER',
        repositoryFullName: result.selectedRepository,
      })
      .eq('id', run.id)
      .in('status', ['ANALYZING', 'WAITING_FOR_USER'])
      .select(
        'id, ticketPublicId, status, repositoryFullName, branchName, pullRequestUrl, lastError, retryCount, attemptNumber, failureStage, failureCode, retryable, createdByDiscordId, createdAt, updatedAt',
      )
      .single();
    if (updateError) throw new Error(updateError.message);
    await recordEvent(run.id, 'ANALYSIS_COMPLETED', actorDiscordId, {
      decision: result.decision,
      complexity: result.complexity,
      confidence: result.confidence,
      selectedRepository: result.selectedRepository,
      automaticallyApproved: automaticallyEligible,
      source,
      ...(fallbackReason ? { fallbackReason } : {}),
    });
    if (automaticallyEligible)
      await recordEvent(run.id, 'ANALYSIS_APPROVED', actorDiscordId, {
        selectedRepository: result.selectedRepository,
        automatic: true,
      });
    return {
      run: updatedRun as CodexRunRecord,
      analysis: data as CodexAnalysisRecord,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Analysis failed';
    await createAdminClient()
      .from('CodexRun')
      .update({ status: 'FAILED', lastError: message })
      .eq('id', run.id)
      .in('status', ['ANALYZING', 'WAITING_FOR_USER']);
    await recordEvent(run.id, 'ANALYSIS_FAILED', actorDiscordId, {
      error: message,
    });
    throw error;
  }
}

async function requestSemanticAnalysis(
  runId: string,
  requestedRepository: string | null,
): Promise<SemanticAnalysisResponse> {
  const { analysisRunnerUrl, runnerSharedSecret } = getBotukiEnv();
  if (!analysisRunnerUrl || !runnerSharedSecret)
    throw new Error('El runner de análisis semántico no está configurado');
  const payload = JSON.stringify({ runId, requestedRepository });
  const signature = createHmac('sha256', runnerSharedSecret)
    .update(payload)
    .digest('hex');
  let response: Response;
  try {
    response = await fetch(analysisRunnerUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-botuki-analysis-signature': signature,
      },
      body: payload,
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    throw new Error(
      'No fue posible conectar con el runner de análisis semántico',
    );
  }
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 300);
    throw new Error(
      `El runner de análisis semántico respondió ${response.status}${detail ? `: ${detail}` : ''}`,
    );
  }
  const value = (await response.json()) as Partial<SemanticAnalysisResponse>;
  if (
    !value ||
    typeof value.model !== 'string' ||
    typeof value.promptVersion !== 'string' ||
    typeof value.latencyMs !== 'number' ||
    !value.usage ||
    !Object.values(value.usage).every(
      (token) => typeof token === 'number' && token >= 0,
    )
  )
    throw new Error(
      'El runner de análisis semántico devolvió una respuesta inválida',
    );
  return value as SemanticAnalysisResponse;
}

export async function cancelCodexRun(
  run: CodexRunRecord,
  actorDiscordId: string,
) {
  if (!canTransitionCodexRun(run.status, 'CANCELLED'))
    throw new Error(
      `No se puede cancelar una ejecución en estado ${run.status}`,
    );

  const { data, error } = await createAdminClient()
    .from('CodexRun')
    .update({ status: 'CANCELLED' })
    .eq('id', run.id)
    .eq('status', run.status)
    .select(
      'id, ticketPublicId, status, repositoryFullName, branchName, pullRequestUrl, lastError, retryCount, attemptNumber, failureStage, failureCode, retryable, createdByDiscordId, createdAt, updatedAt',
    )
    .single();
  if (error) throw new Error(error.message);
  const cancelled = data as CodexRunRecord;
  await recordEvent(cancelled.id, 'RUN_CANCELLED', actorDiscordId);
  return cancelled;
}
