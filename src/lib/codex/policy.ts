import type {
  CodexAnalysisResult,
  CodexRepositoryPolicy,
  CodexRunStatus,
} from '@/lib/codex/types';

export const CODEX_MIN_ANALYSIS_CONFIDENCE = 0.8;

function normalizeRepositoryName(repositoryName: string) {
  return repositoryName.trim().toLowerCase();
}

const transitions: Record<CodexRunStatus, readonly CodexRunStatus[]> = {
  IDLE: ['ANALYZING', 'CANCELLED'],
  ANALYZING: ['WAITING_FOR_USER', 'ANALYSIS_APPROVED', 'FAILED', 'CANCELLED'],
  WAITING_FOR_USER: ['ANALYZING', 'CANCELLED', 'EXPIRED'],
  ANALYSIS_APPROVED: ['IMPLEMENTING', 'ANALYZING', 'CANCELLED', 'EXPIRED'],
  IMPLEMENTING: ['VERIFYING', 'FAILED', 'CANCELLED'],
  VERIFYING: ['PR_OPENED', 'IMPLEMENTING', 'FAILED', 'CANCELLED'],
  PR_OPENED: [],
  FAILED: ['ANALYZING', 'IMPLEMENTING', 'CANCELLED', 'EXPIRED'],
  CANCELLED: [],
  EXPIRED: ['ANALYZING', 'CANCELLED'],
};

export function canTransitionCodexRun(
  current: CodexRunStatus,
  next: CodexRunStatus,
) {
  return transitions[current].includes(next);
}

export function isEligibleCodexAnalysis(result: CodexAnalysisResult) {
  return (
    result.decision === 'ELIGIBLE' &&
    result.complexity === 'LOW' &&
    result.confidence >= CODEX_MIN_ANALYSIS_CONFIDENCE &&
    result.questions.length === 0 &&
    result.forbiddenChangesDetected.length === 0 &&
    result.selectedRepository !== null
  );
}

export function canImplementCodexAnalysis(
  result: CodexAnalysisResult,
  policy: CodexRepositoryPolicy,
) {
  return (
    policy.implementationEnabled &&
    isEligibleCodexAnalysis(result) &&
    result.selectedRepository !== null &&
    normalizeRepositoryName(result.selectedRepository) ===
      normalizeRepositoryName(policy.fullName)
  );
}

export function canStartCodexImplementation(
  status: CodexRunStatus,
  result: CodexAnalysisResult,
  policy: CodexRepositoryPolicy,
) {
  return (
    status === 'ANALYSIS_APPROVED' && canImplementCodexAnalysis(result, policy)
  );
}
