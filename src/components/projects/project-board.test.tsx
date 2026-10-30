import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Project } from '@/lib/types';

const project: Project = {
  id: 'project-1',
  name: 'Rial Web',
  description: 'Aplicación principal',
  status: 'BACKLOG',
  platforms: ['NESTOR'],
  urgency: 'MEDIA',
  importance: 'ALTA',
  createdByUserId: 'user-1',
  createdAt: '2026-10-30T10:00:00.000Z',
  updatedAt: '2026-10-30T10:00:00.000Z',
};

vi.mock('@/hooks/use-projects', () => ({
  useProjects: () => ({ data: [project], isLoading: false, error: null }),
  useUpdateProject: () => ({ mutate: vi.fn() }),
}));

vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

vi.mock('@/components/projects/project-modal', () => ({
  ProjectModal: () => null,
}));

import { ProjectBoard } from '@/components/projects/project-board';

describe('ProjectBoard', () => {
  it('no interpola la posición del proyecto durante el arrastre', () => {
    const view = render(<ProjectBoard />);

    const card = view.container.querySelector(
      '[aria-roledescription="draggable"]',
    );
    const classes = card?.className.split(' ');

    expect(card).not.toBeNull();
    expect(classes).toContain('transition-colors');
    expect(classes).not.toContain('transition');
  });
});
