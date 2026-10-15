import type { Ticket } from '@/lib/types';
import type {
  CodexAnalysisResult,
  CodexRepositoryPolicy,
} from '@/lib/codex/types';

const FRONTEND_TERMS = /\b(ui|ux|frontend|front-end|página|pagina|componente|botón|boton|formulario|tabla|filtro|estilo|css|react|next\.js|navegador)\b/i;
const BACKEND_TERMS = /\b(api|backend|back-end|endpoint|nestjs|nest|controller|service|prisma|base de datos|database|http|rest)\b/i;
const WORKER_TERMS = /\b(worker|workers|cola|queue|cloud task|cloud function|scheduler|job|background|procesamiento)\b/i;
const HIGH_COMPLEXITY_TERMS = /\b(arquitectura|migración|migracion|infraestructura|terraform|docker|deploy|despliegue|seguridad|autenticación|autenticacion|autorización|autorizacion|database|base de datos|prisma|schema|esquema|dependencia|dependencias|refactor(?:ización|izacion)?|rebuild|reescribir)\b/i;
const LOW_COMPLEXITY_TERMS = /\b(bug|error|fix|corregir|corrección|correccion|ajuste|cambio menor|texto|label|etiqueta|validación|validacion|filtro|botón|boton|notificación|notificacion|ocultar|mostrar)\b/i;

const forbiddenPatterns = [
  { pattern: /\b(migración|migracion|migration|schema|esquema|prisma)\b/i, label: 'database or schema changes' },
  { pattern: /\b(dependencia|dependencias|dependency|dependencies|package\.json)\b/i, label: 'dependency changes' },
  { pattern: /\b(terraform|infraestructura|infrastructure|docker|deploy|despliegue)\b/i, label: 'infrastructure or deployment changes' },
  { pattern: /\b(secret|secreto|token|credencial|credentials|\.env)\b/i, label: 'secret or credential changes' },
];

function normalize(value: string) {
  return value.toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function repositoryMatches(text: string, policy: CodexRepositoryPolicy) {
  const name = normalize(policy.fullName);
  if (name.endsWith('/rial-frontend')) return FRONTEND_TERMS.test(text);
  if (name.endsWith('/rial-backend')) return BACKEND_TERMS.test(text);
  if (name.endsWith('/rial-workers')) return WORKER_TERMS.test(text);
  return false;
}

export function analyzeTicket(
  ticket: Pick<Ticket, 'title' | 'description'>,
  policies: readonly CodexRepositoryPolicy[],
): CodexAnalysisResult {
  const text = normalize(`${ticket.title}\n${ticket.description}`);
  const analysisPolicies = policies.filter((policy) => policy.analysisEnabled);
  const repositoryCandidates = analysisPolicies
    .filter((policy) => repositoryMatches(text, policy))
    .map((policy) => policy.fullName);
  const selectedRepository = repositoryCandidates.length === 1 ? repositoryCandidates[0] : null;
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
  if (!selectedRepository) questions.push('¿Qué repositorio debe modificarse?');
  if (!ticket.description.trim()) questions.push('¿Qué comportamiento se espera y cuál ocurre actualmente?');
  if (repositoryCandidates.length > 1) questions.push('El ticket parece involucrar más de un repositorio.');
  const risks = forbiddenChangesDetected.length
    ? ['El alcance detectado requiere revisión manual antes de implementar.']
    : complexity !== 'LOW'
      ? ['La complejidad estimada supera el umbral de implementación automática.']
      : [];
  const checks = ['Revisar el repositorio seleccionado.', 'Ejecutar las pruebas relevantes.', 'Verificar que el diff respete la política del repositorio.'];
  const scope = selectedRepository
    ? policies.find((policy) => policy.fullName === selectedRepository)?.allowedPaths ?? []
    : [];
  const decision = forbiddenChangesDetected.length > 0 || (complexity !== 'LOW' && selectedRepository !== null)
    ? 'OUT_OF_SCOPE'
    : questions.length
      ? 'NEEDS_CLARIFICATION'
      : 'ELIGIBLE';
  const confidence = decision === 'ELIGIBLE' ? 0.9 : selectedRepository ? 0.75 : 0.55;

  return {
    decision,
    complexity,
    confidence,
    repositoryCandidates,
    selectedRepository,
    scope,
    checks,
    risks,
    questions,
    forbiddenChangesDetected,
  };
}
