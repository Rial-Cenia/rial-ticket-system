import type { Ticket } from '@/lib/types';
import type {
  CodexAnalysisResult,
  CodexRepositoryPolicy,
} from '@/lib/codex/types';
import { codexAnalysisResultSchema } from '@/lib/codex/schemas';

const FRONTEND_TERMS =
  /\b(ui|ux|frontend|front-end|front end|página|pagina|componente|botón|boton|formulario|tabla|filtro|estilo|css|react|next\.js|navegador|pantalla|vista|modal|visual|interfaz|cliente)\b/i;
const BACKEND_TERMS =
  /\b(api|backend|back-end|back end|endpoint|nestjs|nest|controller|service|prisma|base de datos|database|http|rest|servidor|autenticación|autorización|query|ruta|route)\b/i;
const WORKER_TERMS =
  /\b(worker|workers|cola|queue|cloud task|cloud function|scheduler|job|background|procesamiento|asíncrono|asincrono|cron|tarea programada)\b/i;
const PLAYGROUND_TERMS = /\b(playground|gradio|hugging ?face|hf space)\b/i;
const PIPELINE_TERMS =
  /\b(pipeline|pipelines|tryon|try-on|try on|upscale|upscaling|inpaint|inpainting|prompt engine|generacion de imagenes|generacion de video)\b/i;
const PIPELINE_TESTER_TERMS =
  /\b(pipelinejsons|pipeline_json_generator|pipeline_abc|pipeline tester)\b/i;
const MODAL_WORKER_TERMS =
  /\b(modal app|gpu|h100|sapiens|birefnet|lama|cold start)\b/i;
const HIGH_COMPLEXITY_TERMS =
  /\b(arquitectura|migración|migracion|infraestructura|terraform|docker|deploy|despliegue|seguridad|autenticación|autenticacion|autorización|autorizacion|database|base de datos|prisma|schema|esquema|dependencia|dependencias|refactor(?:ización|izacion)?|rebuild|reescribir)\b/i;
const LOW_COMPLEXITY_TERMS =
  /\b(bug|error|fix|corregir|corrección|correccion|ajuste|cambio menor|texto|label|etiqueta|validación|validacion|filtro|botón|boton|notificación|notificacion|ocultar|mostrar)\b/i;

const forbiddenPatterns = [
  {
    pattern: /\b(migración|migracion|migration|schema|esquema|prisma)\b/i,
    label: 'database or schema changes',
  },
  {
    pattern:
      /\b(dependencia|dependencias|dependency|dependencies|package\.json)\b/i,
    label: 'dependency changes',
  },
  {
    pattern:
      /\b(terraform|infraestructura|infrastructure|docker|deploy|despliegue)\b/i,
    label: 'infrastructure or deployment changes',
  },
  {
    pattern: /\b(secret|secreto|token|credencial|credentials|\.env)\b/i,
    label: 'secret or credential changes',
  },
  {
    pattern:
      /\b(auth|oauth|autenticación|autenticacion|autorización|autorizacion|permiso|permisos|rol|roles)\b/i,
    label: 'authentication or permission changes',
  },
  {
    pattern: /\b(integración|integracion|webhook|third[- ]party|tercero)\b/i,
    label: 'external integration changes',
  },
];

function normalize(value: string) {
  return value
    .toLocaleLowerCase('es')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function repositoryMatches(text: string, policy: CodexRepositoryPolicy) {
  const name = normalize(policy.fullName);
  if (name.endsWith('/rial-frontend')) return FRONTEND_TERMS.test(text);
  if (name.endsWith('/rial-backend')) return BACKEND_TERMS.test(text);
  if (name.endsWith('/rial-workers')) return WORKER_TERMS.test(text);
  if (name.endsWith('/playground')) return PLAYGROUND_TERMS.test(text);
  if (name.endsWith('/pipelines')) return PIPELINE_TERMS.test(text);
  if (name.endsWith('/pipeline-tester'))
    return PIPELINE_TESTER_TERMS.test(text);
  if (name.endsWith('/modal-workers')) return MODAL_WORKER_TERMS.test(text);
  return false;
}

const repositoryAliases: Record<string, string> = {
  'pipeline-tester': 'pipeline-tester',
  'modal-workers': 'modal-workers',
  playground: 'playground',
  pg: 'playground',
  pipelines: 'pipelines',
  frontend: 'rial-frontend',
  'front-end': 'rial-frontend',
  'front end': 'rial-frontend',
  backend: 'rial-backend',
  'back-end': 'rial-backend',
  'back end': 'rial-backend',
  workers: 'rial-workers',
  worker: 'rial-workers',
  'platform-docker': 'rial-platform-docker',
  docker: 'rial-platform-docker',
};

function explicitRepository(
  text: string,
  policies: readonly CodexRepositoryPolicy[],
) {
  const match = Object.entries(repositoryAliases).find(([alias]) =>
    new RegExp(
      `(?:^|[\\s/_-])${alias.replace('-', '[\\s_-]?')}(?:$|[\\s/_-])`,
      'i',
    ).test(text),
  );
  if (!match) return null;
  return (
    policies.find((policy) =>
      normalize(policy.fullName).endsWith(`/${match[1]}`),
    )?.fullName ?? null
  );
}

const repositoryQuestion = '¿Qué repositorio debe modificarse?';

function conciseQuestions(
  questions: readonly string[],
  selectedRepository: string | null,
  repositoryCandidates: readonly string[],
) {
  const normalized = Array.from(
    new Set(
      questions
        .map((question) => question.trim())
        .filter(Boolean)
        .filter((question) => !/qué es(?: exactamente)? nestor/i.test(question)),
    ),
  );
  if (!selectedRepository && repositoryCandidates.length === 0) {
    normalized.unshift(repositoryQuestion);
  }
  return Array.from(new Set(normalized)).slice(0, 3);
}

function conciseRisks(risks: readonly string[]) {
  return Array.from(
    new Set(risks.map((risk) => risk.trim()).filter(Boolean)),
  ).slice(0, 2);
}

export function analyzeTicket(
  ticket: Pick<Ticket, 'title' | 'description'>,
  policies: readonly CodexRepositoryPolicy[],
  requestedRepository?: string | null,
): CodexAnalysisResult {
  const text = normalize(`${ticket.title}\n${ticket.description}`);
  const analysisPolicies = policies.filter((policy) => policy.analysisEnabled);
  const hintedRepository = requestedRepository
    ? explicitRepository(requestedRepository, analysisPolicies)
    : explicitRepository(text, analysisPolicies);
  const repositoryCandidates = hintedRepository
    ? [hintedRepository]
    : analysisPolicies
        .filter((policy) => repositoryMatches(text, policy))
        .map((policy) => policy.fullName);
  const selectedRepository =
    repositoryCandidates.length === 1 ? repositoryCandidates[0] : null;
  const selectedPolicy = analysisPolicies.find(
    (policy) => policy.fullName === selectedRepository,
  );
  const forbiddenChangesDetected = forbiddenPatterns
    .filter(({ pattern }) => pattern.test(text))
    .map(({ label }) => label);
  const hasHighComplexitySignal = HIGH_COMPLEXITY_TERMS.test(text);
  const hasLowComplexitySignal = LOW_COMPLEXITY_TERMS.test(text);
  const complexity = hasHighComplexitySignal
    ? 'HIGH'
    : hasLowComplexitySignal && selectedRepository
      ? 'LOW'
      : 'MEDIUM';
  const questions: string[] = [];
  if (!selectedRepository) questions.push(repositoryQuestion);
  if (!ticket.description.trim())
    questions.push('¿Qué comportamiento se espera y cuál ocurre actualmente?');
  if (repositoryCandidates.length > 1)
    questions.push('El ticket parece involucrar más de un repositorio.');
  const risks = forbiddenChangesDetected.length
    ? ['El alcance detectado requiere revisión manual antes de implementar.']
    : complexity !== 'LOW'
      ? [
          'La complejidad estimada supera el umbral de implementación automática.',
        ]
      : [];
  const checks = [
    'Revisar el repositorio seleccionado.',
    'Ejecutar las pruebas relevantes.',
    'Verificar que el diff respete la política del repositorio.',
  ];
  const scope = selectedRepository
    ? (policies.find((policy) => policy.fullName === selectedRepository)
        ?.allowedPaths ?? [])
    : [];
  const decision =
    forbiddenChangesDetected.length > 0 ||
    (complexity !== 'LOW' && selectedRepository !== null) ||
    (selectedRepository !== null &&
      selectedPolicy?.implementationEnabled === false)
      ? 'OUT_OF_SCOPE'
      : questions.length
        ? 'NEEDS_CLARIFICATION'
        : 'ELIGIBLE';
  const confidence =
    decision === 'ELIGIBLE' ? 0.9 : selectedRepository ? 0.75 : 0.55;

  return {
    decision,
    complexity,
    confidence,
    repositoryCandidates,
    selectedRepository,
    scope,
    checks,
    risks: conciseRisks(risks),
    questions: conciseQuestions(
      questions,
      selectedRepository,
      repositoryCandidates,
    ),
    forbiddenChangesDetected,
  };
}

export function analyzeDeterministicGuardrail(
  ticket: Pick<Ticket, 'title' | 'description'>,
  policies: readonly CodexRepositoryPolicy[],
  requestedRepository?: string | null,
): CodexAnalysisResult | null {
  const deterministic = analyzeTicket(ticket, policies, requestedRepository);
  if (!deterministic.forbiddenChangesDetected.length) return null;
  return deterministic;
}

export function createAnalysisFallback(
  ticket: Pick<Ticket, 'title' | 'description'>,
  policies: readonly CodexRepositoryPolicy[],
  reason: string,
  requestedRepository?: string | null,
): CodexAnalysisResult {
  const deterministic = analyzeTicket(ticket, policies, requestedRepository);
  if (deterministic.decision === 'OUT_OF_SCOPE') return deterministic;

  return {
    ...deterministic,
    decision: 'NEEDS_CLARIFICATION',
    confidence: Math.min(deterministic.confidence, 0.5),
    questions: conciseQuestions(
      [
        ...deterministic.questions,
        '¿Puedes compartir el mensaje exacto del error o una captura?',
      ],
      deterministic.selectedRepository,
      deterministic.repositoryCandidates,
    ),
    risks: conciseRisks([...deterministic.risks, reason]),
  };
}

export function validateSemanticAnalysis(
  value: unknown,
  ticket: Pick<Ticket, 'title' | 'description'>,
  policies: readonly CodexRepositoryPolicy[],
  requestedRepository?: string | null,
): CodexAnalysisResult {
  const parsed = codexAnalysisResultSchema.parse(value);
  const allowedPolicies = policies.filter((policy) => policy.analysisEnabled);
  const allowedRepositories = new Set(
    allowedPolicies.map((policy) => policy.fullName),
  );
  const forcedRepository = requestedRepository
    ? explicitRepository(requestedRepository, allowedPolicies)
    : null;
  const candidates = Array.from(
    new Set(
      parsed.repositoryCandidates.filter((repository) =>
        allowedRepositories.has(repository),
      ),
    ),
  );
  const selectedRepository =
    parsed.selectedRepository &&
    allowedRepositories.has(parsed.selectedRepository)
      ? parsed.selectedRepository
      : null;
  const deterministicGuardrail = analyzeDeterministicGuardrail(
    ticket,
    policies,
    requestedRepository,
  );
  if (deterministicGuardrail) return deterministicGuardrail;
  const deterministicHint = analyzeTicket(ticket, policies, requestedRepository);

  const repositoryMismatch =
    Boolean(forcedRepository) && selectedRepository !== forcedRepository;
  const repositoryCandidates = forcedRepository
    ? [forcedRepository]
    : candidates;
  const normalizedSelectedRepository = repositoryMismatch
    ? null
    : (forcedRepository ?? selectedRepository);
  const selectedPolicy = allowedPolicies.find(
    (policy) => policy.fullName === normalizedSelectedRepository,
  );
  const hasSafeLowComplexityEvidence =
    normalizedSelectedRepository !== null &&
    normalizedSelectedRepository === deterministicHint.selectedRepository &&
    deterministicHint.complexity === 'LOW' &&
    deterministicHint.forbiddenChangesDetected.length === 0 &&
    parsed.complexity === 'LOW';
  const questions = [...parsed.questions];
  const risks = [...parsed.risks];
  if (repositoryMismatch)
    questions.push(
      'El repositorio indicado no coincide con el análisis. Confirma el repositorio a modificar.',
    );
  if (!normalizedSelectedRepository) questions.push(repositoryQuestion);
  if (selectedPolicy?.implementationEnabled === false)
    risks.push(
      'El repositorio seleccionado no permite implementación automática.',
    );

  const uniqueQuestions = conciseQuestions(
    questions,
    normalizedSelectedRepository,
    repositoryCandidates,
  );
  const blockingQuestions = hasSafeLowComplexityEvidence ? [] : uniqueQuestions;
  const decision =
    parsed.decision === 'OUT_OF_SCOPE' ||
    selectedPolicy?.implementationEnabled === false
      ? 'OUT_OF_SCOPE'
      : blockingQuestions.length
        ? 'NEEDS_CLARIFICATION'
        : hasSafeLowComplexityEvidence
          ? 'ELIGIBLE'
          : parsed.decision;

  return {
    ...parsed,
    decision,
    confidence: hasSafeLowComplexityEvidence
      ? Math.max(parsed.confidence, deterministicHint.confidence)
      : parsed.confidence,
    repositoryCandidates,
    selectedRepository: normalizedSelectedRepository,
    questions: blockingQuestions,
    risks: hasSafeLowComplexityEvidence ? [] : conciseRisks(risks),
    forbiddenChangesDetected: [],
  };
}
