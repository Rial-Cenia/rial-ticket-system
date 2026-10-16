export const CODEX_RUN_STATUSES = [
  'IDLE',
  'ANALYZING',
  'WAITING_FOR_USER',
  'ANALYSIS_APPROVED',
  'IMPLEMENTING',
  'VERIFYING',
  'PR_OPENED',
  'FAILED',
  'CANCELLED',
  'EXPIRED',
] as const;

export const CODEX_ANALYSIS_DECISIONS = [
  'ELIGIBLE',
  'NEEDS_CLARIFICATION',
  'OUT_OF_SCOPE',
] as const;

export const CODEX_COMPLEXITIES = ['LOW', 'MEDIUM', 'HIGH'] as const;

export type CodexRunStatus = (typeof CODEX_RUN_STATUSES)[number];
export type CodexAnalysisDecision = (typeof CODEX_ANALYSIS_DECISIONS)[number];
export type CodexComplexity = (typeof CODEX_COMPLEXITIES)[number];

export const CODEX_MAX_IMPLEMENTATION_RETRIES = 3;

export interface CodexRepositoryPolicy {
  fullName: string;
  baseBranch: string;
  analysisEnabled: boolean;
  implementationEnabled: boolean;
  allowedPaths: string[];
  forbiddenPaths: string[];
  allowDependencyChanges: boolean;
  allowDatabaseChanges: boolean;
  maxChangedFiles: number;
}

export interface CodexAnalysisResult {
  decision: CodexAnalysisDecision;
  complexity: CodexComplexity;
  confidence: number;
  repositoryCandidates: string[];
  selectedRepository: string | null;
  scope: string[];
  checks: string[];
  risks: string[];
  questions: string[];
  forbiddenChangesDetected: string[];
}

export const NESTOR_CODEX_REPOSITORY_POLICIES: readonly CodexRepositoryPolicy[] =
  [
    {
      fullName: 'Rial-Cenia/rial-frontend',
      baseBranch: 'develop',
      analysisEnabled: true,
      implementationEnabled: true,
      allowedPaths: ['src/', 'tests/', 'e2e/'],
      forbiddenPaths: ['.env', '.env.*', '.github/', 'supabase/migrations/'],
      allowDependencyChanges: false,
      allowDatabaseChanges: false,
      maxChangedFiles: 30,
    },
    {
      fullName: 'Rial-Cenia/rial-backend',
      baseBranch: 'develop',
      analysisEnabled: true,
      implementationEnabled: true,
      allowedPaths: ['src/', 'test/', 'tests/'],
      forbiddenPaths: [
        '.env',
        '.env.*',
        '.github/',
        'prisma/migrations/',
        'supabase/migrations/',
      ],
      allowDependencyChanges: false,
      allowDatabaseChanges: false,
      maxChangedFiles: 30,
    },
    {
      fullName: 'Rial-Cenia/rial-workers',
      baseBranch: 'develop',
      analysisEnabled: true,
      implementationEnabled: true,
      allowedPaths: ['src/', 'test/', 'tests/'],
      forbiddenPaths: [
        '.env',
        '.env.*',
        '.github/',
        'terraform/',
        'infra/',
        'deploy/',
      ],
      allowDependencyChanges: false,
      allowDatabaseChanges: false,
      maxChangedFiles: 30,
    },
    {
      fullName: 'Rial-Cenia/rial-platform-docker',
      baseBranch: 'develop',
      analysisEnabled: true,
      implementationEnabled: false,
      allowedPaths: [],
      forbiddenPaths: ['*'],
      allowDependencyChanges: false,
      allowDatabaseChanges: false,
      maxChangedFiles: 0,
    },
  ];
