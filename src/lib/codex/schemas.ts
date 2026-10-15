import { z } from 'zod';
import {
  CODEX_ANALYSIS_DECISIONS,
  CODEX_COMPLEXITIES,
} from '@/lib/codex/types';

export const codexAnalysisResultSchema = z.object({
  decision: z.enum(CODEX_ANALYSIS_DECISIONS),
  complexity: z.enum(CODEX_COMPLEXITIES),
  confidence: z.number().min(0).max(1),
  repositoryCandidates: z.array(z.string().min(1)),
  selectedRepository: z.string().min(1).nullable(),
  scope: z.array(z.string().min(1)),
  checks: z.array(z.string().min(1)),
  risks: z.array(z.string().min(1)),
  questions: z.array(z.string().min(1)),
  forbiddenChangesDetected: z.array(z.string().min(1)),
});

export type CodexAnalysisResultInput = z.infer<
  typeof codexAnalysisResultSchema
>;
