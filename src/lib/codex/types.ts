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

export const CODEX_REPOSITORY_PROVIDERS = [
  'GITHUB',
  'HUGGINGFACE_SPACE',
] as const;

export type CodexRepositoryProvider =
  (typeof CODEX_REPOSITORY_PROVIDERS)[number];

export interface CodexRepositoryPolicy {
  fullName: string;
  provider: CodexRepositoryProvider;
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
      provider: 'GITHUB',
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
      provider: 'GITHUB',
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
      provider: 'GITHUB',
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
      provider: 'GITHUB',
      baseBranch: 'develop',
      analysisEnabled: true,
      implementationEnabled: false,
      allowedPaths: [],
      forbiddenPaths: ['*'],
      allowDependencyChanges: false,
      allowDatabaseChanges: false,
      maxChangedFiles: 0,
    },
    {
      fullName: 'RIAL-AI/Playground',
      provider: 'HUGGINGFACE_SPACE',
      baseBranch: 'main',
      analysisEnabled: true,
      implementationEnabled: true,
      allowedPaths: [
        'app.py',
        'interfaces/',
        'pipelines/',
        'tests/',
        'dashboard/',
        'run_templaterunner_parallel.py',
      ],
      forbiddenPaths: [
        '.env',
        '.env.*',
        'README.md',
        '.gitattributes',
        '.gitignore',
        'launcher/',
        'modal_apps/',
        'interfaces/static/',
        'rial-*.json',
        '*.xlsx',
      ],
      allowDependencyChanges: false,
      allowDatabaseChanges: false,
      maxChangedFiles: 30,
    },
    {
      fullName: 'Rial-Cenia/pipelines',
      provider: 'GITHUB',
      baseBranch: 'main',
      analysisEnabled: true,
      implementationEnabled: true,
      allowedPaths: ['*.py', 'core/', 'models/'],
      forbiddenPaths: [
        '.env',
        '.env.*',
        '.github/',
        '.gitignore',
        '.pre-commit-config.yaml',
        '*.xlsx',
      ],
      allowDependencyChanges: false,
      allowDatabaseChanges: false,
      maxChangedFiles: 30,
    },
    {
      fullName: 'Rial-Cenia/pipeline-tester',
      provider: 'GITHUB',
      baseBranch: 'main',
      analysisEnabled: true,
      implementationEnabled: true,
      allowedPaths: ['models/', 'main.py', 'pipeline_json_generator.py'],
      forbiddenPaths: [
        '.env',
        '.env.*',
        '.github/',
        '.gitmodules',
        '.pre-commit-config.yaml',
        'pipelines',
        'PipelineJsons/',
        'Dockerfile',
        'rial-*.json',
      ],
      allowDependencyChanges: false,
      allowDatabaseChanges: false,
      maxChangedFiles: 30,
    },
    {
      fullName: 'Rial-Cenia/modal-workers',
      provider: 'GITHUB',
      baseBranch: 'main',
      analysisEnabled: true,
      implementationEnabled: true,
      allowedPaths: ['*.py', 'README.md'],
      forbiddenPaths: [
        '.env',
        '.env.*',
        '.github/',
        '.claude/',
        '.firecrawl/',
        '*.pth',
        '*.png',
        '*.jpg',
      ],
      allowDependencyChanges: false,
      allowDatabaseChanges: false,
      maxChangedFiles: 30,
    },
  ];
