import { describe, expect, it } from 'vitest';
import {
  canImplementCodexAnalysis,
  canStartCodexImplementation,
  canTransitionCodexRun,
  isEligibleCodexAnalysis,
} from '@/lib/codex/policy';
import type {
  CodexAnalysisResult,
  CodexRepositoryPolicy,
} from '@/lib/codex/types';

const analysis: CodexAnalysisResult = {
  decision: 'ELIGIBLE',
  complexity: 'LOW',
  confidence: 0.9,
  repositoryCandidates: ['Rial-Cenia/rial-frontend'],
  selectedRepository: 'Rial-Cenia/rial-frontend',
  scope: ['src/'],
  checks: ['lint', 'typecheck'],
  risks: [],
  questions: [],
  forbiddenChangesDetected: [],
};

const frontendPolicy: CodexRepositoryPolicy = {
  fullName: 'Rial-Cenia/rial-frontend',
  baseBranch: 'develop',
  analysisEnabled: true,
  implementationEnabled: true,
  allowedPaths: ['src/'],
  forbiddenPaths: ['.env'],
  allowDependencyChanges: false,
  allowDatabaseChanges: false,
  maxChangedFiles: 30,
};

describe('Codex policy', () => {
  it('requires a low-complexity analysis with no open questions', () => {
    expect(isEligibleCodexAnalysis(analysis)).toBe(true);
    expect(isEligibleCodexAnalysis({ ...analysis, confidence: 0.79 })).toBe(
      false,
    );
    expect(
      isEligibleCodexAnalysis({ ...analysis, questions: ['¿Qué pantalla?'] }),
    ).toBe(false);
  });

  it('requires implementation to be enabled for the selected repository', () => {
    expect(canImplementCodexAnalysis(analysis, frontendPolicy)).toBe(true);
    expect(
      canImplementCodexAnalysis(analysis, {
        ...frontendPolicy,
        implementationEnabled: false,
      }),
    ).toBe(false);
  });

  it('requires the approved run state before implementation', () => {
    expect(
      canStartCodexImplementation(
        'ANALYSIS_APPROVED',
        analysis,
        frontendPolicy,
      ),
    ).toBe(true);
    expect(
      canStartCodexImplementation('ANALYZING', analysis, frontendPolicy),
    ).toBe(false);
    expect(
      canImplementCodexAnalysis(analysis, {
        ...frontendPolicy,
        fullName: 'rial-cenia/rial-frontend',
      }),
    ).toBe(true);
  });

  it('allows only declared run transitions', () => {
    expect(canTransitionCodexRun('IDLE', 'ANALYZING')).toBe(true);
    expect(canTransitionCodexRun('IDLE', 'IMPLEMENTING')).toBe(false);
    expect(canTransitionCodexRun('PR_OPENED', 'IMPLEMENTING')).toBe(false);
  });
});
