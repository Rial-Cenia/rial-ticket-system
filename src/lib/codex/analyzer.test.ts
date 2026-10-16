import { describe, expect, it } from 'vitest';
import { analyzeTicket } from '@/lib/codex/analyzer';
import { NESTOR_CODEX_REPOSITORY_POLICIES } from '@/lib/codex/types';

describe('analyzeTicket', () => {
  it('classifies a focused frontend bug as eligible low complexity', () => {
    const result = analyzeTicket(
      {
        title: 'Botón de filtro no actualiza la tabla',
        description: 'Corregir el error visual en la página de proyectos.',
      },
      NESTOR_CODEX_REPOSITORY_POLICIES,
    );

    expect(result).toMatchObject({
      decision: 'ELIGIBLE',
      complexity: 'LOW',
      selectedRepository: 'Rial-Cenia/rial-frontend',
      confidence: 0.9,
    });
  });

  it('rejects database and dependency work from automatic implementation', () => {
    const result = analyzeTicket(
      {
        title: 'Agregar campo al schema de Prisma',
        description:
          'Crear una migración y actualizar la dependencia del cliente.',
      },
      NESTOR_CODEX_REPOSITORY_POLICIES,
    );

    expect(result.decision).toBe('OUT_OF_SCOPE');
    expect(result.complexity).toBe('HIGH');
    expect(result.forbiddenChangesDetected).toEqual([
      'database or schema changes',
      'dependency changes',
    ]);
  });

  it('asks for clarification when repository ownership is ambiguous', () => {
    const result = analyzeTicket(
      {
        title: 'Corregir error de notificación',
        description: 'La notificación no llega al usuario.',
      },
      NESTOR_CODEX_REPOSITORY_POLICIES,
    );

    expect(result.decision).toBe('NEEDS_CLARIFICATION');
    expect(result.selectedRepository).toBeNull();
    expect(result.questions).toContain('¿Qué repositorio debe modificarse?');
  });

  it('honors an explicit repository override for ambiguous tickets', () => {
    const result = analyzeTicket(
      {
        title: 'Notificación falsa en Nestor',
        description: 'La notificación aparece antes de completar la operación.',
      },
      NESTOR_CODEX_REPOSITORY_POLICIES,
      'frontend',
    );

    expect(result.selectedRepository).toBe('Rial-Cenia/rial-frontend');
    expect(result.decision).toBe('ELIGIBLE');
  });
});
