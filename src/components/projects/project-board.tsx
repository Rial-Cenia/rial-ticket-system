'use client';

import {
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { ProjectModal } from '@/components/projects/project-modal';
import { useProjects, useUpdateProject } from '@/hooks/use-projects';
import {
  PROJECT_LEVEL_LABELS,
  PLATFORM_LABELS,
  PROJECT_STATUS_LABELS,
  PROJECT_STATUSES,
  type Project,
  type ProjectStatus,
} from '@/lib/types';
import { cn } from '@/lib/utils';

export function ProjectBoard() {
  const projects = useProjects();
  const update = useUpdateProject();
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  function openProject(project: Project | null) {
    setSelectedProject(project);
    setOpen(true);
  }

  function handleDragEnd(event: DragEndEvent) {
    const project = projects.data?.find((item) => item.id === event.active.id);
    const status = typeof event.over?.id === 'string' ? event.over.id : null;
    if (
      project &&
      status &&
      PROJECT_STATUSES.includes(status as ProjectStatus) &&
      project.status !== status
    ) {
      update.mutate(
        { projectId: project.id, input: { status: status as ProjectStatus } },
        {
          onSuccess: () =>
            showToast({
              variant: 'success',
              message: 'Estado del proyecto actualizado.',
            }),
          onError: (error) =>
            showToast({
              variant: 'error',
              message:
                error instanceof Error
                  ? error.message
                  : 'No fue posible mover el proyecto.',
            }),
        },
      );
    }
  }

  if (projects.isLoading)
    return (
      <div className="h-72 animate-pulse rounded-xl border border-white/8 bg-white/4" />
    );
  if (projects.error)
    return (
      <p className="project-error rounded-xl bg-red-500/10 p-4">
        {projects.error.message}
      </p>
    );

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-1 text-xs uppercase tracking-wider text-zinc-500">
            Portafolio · Scrum
          </p>
          <h1 className="text-2xl font-semibold">Proyectos</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Vista transversal para todas las tecnologías
          </p>
        </div>
        <Button onClick={() => openProject(null)}>
          <Plus className="size-4" /> Nuevo proyecto
        </Button>
      </header>
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-3">
          {PROJECT_STATUSES.map((status) => (
            <ProjectColumn
              key={status}
              status={status}
              projects={
                projects.data?.filter((project) => project.status === status) ??
                []
              }
              onOpen={openProject}
            />
          ))}
        </div>
      </DndContext>
      {open && (
        <ProjectModal
          key={selectedProject?.id ?? 'new'}
          project={selectedProject}
          open
          onOpenChange={setOpen}
        />
      )}
    </div>
  );
}

function ProjectColumn({
  status,
  projects,
  onOpen,
}: {
  status: ProjectStatus;
  projects: Project[];
  onOpen: (project: Project) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <section
      ref={setNodeRef}
      className={cn(
        'w-80 shrink-0 rounded-2xl border border-white/8 bg-zinc-950/60 p-3',
        isOver && 'border-blue-400/50 bg-blue-500/5',
      )}
    >
      <header className="mb-3 flex items-center justify-between px-1">
        <h2 className="font-medium">{PROJECT_STATUS_LABELS[status]}</h2>
        <Badge>{projects.length}</Badge>
      </header>
      <div className="min-h-24 space-y-3">
        {projects.map((project) => (
          <DraggableProjectCard
            key={project.id}
            project={project}
            onOpen={onOpen}
          />
        ))}
      </div>
    </section>
  );
}

function DraggableProjectCard({
  project,
  onOpen,
}: {
  project: Project;
  onOpen: (project: Project) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: project.id });
  return (
    <button
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={cn(
        'block w-full rounded-xl border border-white/8 bg-zinc-900 p-3 text-left shadow-sm transition hover:border-white/20',
        isDragging && 'z-50 opacity-60',
      )}
      onClick={() => onOpen(project)}
      {...listeners}
      {...attributes}
    >
      <h3 className="font-medium text-zinc-100">{project.name}</h3>
      <div className="mt-3 flex flex-wrap gap-1">
        {project.platforms.map((platform) => (
          <Badge key={platform}>{PLATFORM_LABELS[platform]}</Badge>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-zinc-500">
        <span>Urgencia: {PROJECT_LEVEL_LABELS[project.urgency]}</span>
        <span>Importancia: {PROJECT_LEVEL_LABELS[project.importance]}</span>
      </div>
    </button>
  );
}
