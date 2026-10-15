import { describe, expect, it } from 'vitest';
import { codexAnalysisResultSchema } from '@/lib/codex/schemas';

describe('Codex analysis schema', () => {
  it('accepts a structured low-complexity result', () => {
    expect(
      codexAnalysisResultSchema.parse({
        decision: 'ELIGIBLE',
        complexity: 'LOW',
        confidence: 0.85,
        repositoryCandidates: ['Rial-Cenia/rial-frontend'],
        selectedRepository: 'Rial-Cenia/rial-frontend',
        scope: ['src/'],
        checks: ['lint'],
        risks: [],
        questions: [],
        forbiddenChangesDetected: [],
      }),
    ).toMatchObject({ complexity: 'LOW', confidence: 0.85 });
  });

  it('rejects invalid confidence and unknown decisions', () => {
    expect(() =>
      codexAnalysisResultSchema.parse({
        decision: 'ELIGIBLE',
        complexity: 'LOW',
        confidence: 1.1,
        repositoryCandidates: [],
        selectedRepository: null,
        scope: [],
        checks: [],
        risks: [],
        questions: [],
        forbiddenChangesDetected: [],
      }),
    ).toThrow();
    expect(() =>
      codexAnalysisResultSchema.parse({
        decision: 'APPROVED',
        complexity: 'LOW',
        confidence: 0.9,
        repositoryCandidates: [],
        selectedRepository: null,
        scope: [],
        checks: [],
        risks: [],
        questions: [],
        forbiddenChangesDetected: [],
      }),
    ).toThrow();
  });
});
