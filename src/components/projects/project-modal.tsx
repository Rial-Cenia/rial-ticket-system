'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';
import { useCreateProject, useUpdateProject } from '@/hooks/use-projects';
import {
  KANBAN_PRIORITIES,
  PLATFORM_LABELS,
  PLATFORMS,
  PROJECT_LEVEL_LABELS,
  PROJECT_STATUS_LABELS,
  PROJECT_STATUSES,
  type KanbanPriority,
  type Platform,
  type Project,
  type ProjectStatus,
} from '@/lib/types';

interface Props {
  project: Project | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ProjectForm {
  name: string;
  status: ProjectStatus;
  platforms: Platform[];
  urgency: KanbanPriority;
  importance: KanbanPriority;
}

export function ProjectModal({ project, open, onOpenChange }: Props) {
  const create = useCreateProject();
  const update = useUpdateProject();
  const { showToast } = useToast();
  const [form, setForm] = useState<ProjectForm>(() => initialForm(project));
  const [error, setError] = useState('');
  const isPending = create.isPending || update.isPending;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    try {
      if (project)
        await update.mutateAsync({ projectId: project.id, input: form });
      else await create.mutateAsync(form);
      showToast({
        variant: 'success',
        message: project ? 'Proyecto actualizado.' : 'Proyecto creado.',
      });
      onOpenChange(false);
    } catch (mutationError) {
      const message =
        mutationError instanceof Error
          ? mutationError.message
          : 'No fue posible guardar el proyecto.';
      setError(message);
      showToast({ variant: 'error', message });
    }
  }

  function togglePlatform(platform: Platform) {
    setForm((current) => ({
      ...current,
      platforms: current.platforms.includes(platform)
        ? current.platforms.filter((item) => item !== platform)
        : [...current.platforms, platform],
    }));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {project ? 'Editar proyecto' : 'Nuevo proyecto'}
          </DialogTitle>
          <DialogDescription>
            Define las plataformas y los niveles de urgencia e importancia.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={submit}>
          <label className="block space-y-1 text-sm">
            <span>Nombre</span>
            <Input
              required
              maxLength={200}
              value={form.name}
              onChange={(event) =>
                setForm({ ...form, name: event.target.value })
              }
            />
          </label>
          <div className="space-y-2 text-sm">
            <p>Plataformas</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {PLATFORMS.map((platform) => (
                <label
                  key={platform}
                  className="flex items-center gap-2 rounded-lg border border-white/8 bg-white/4 px-3 py-2 text-zinc-300"
                >
                  <input
                    type="checkbox"
                    checked={form.platforms.includes(platform)}
                    onChange={() => togglePlatform(platform)}
                    className="accent-blue-600"
                  />
                  {PLATFORM_LABELS[platform]}
                </label>
              ))}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Estado">
              <Select
                value={form.status}
                onValueChange={(status) =>
                  setForm({ ...form, status: status as ProjectStatus })
                }
              >
                <SelectTrigger className="w-full min-w-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROJECT_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {PROJECT_STATUS_LABELS[status]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Urgencia">
              <Select
                value={form.urgency}
                onValueChange={(urgency) =>
                  setForm({ ...form, urgency: urgency as KanbanPriority })
                }
              >
                <SelectTrigger className="w-full min-w-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {KANBAN_PRIORITIES.map((priority) => (
                    <SelectItem key={priority} value={priority}>
                      {PROJECT_LEVEL_LABELS[priority]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Importancia">
              <Select
                value={form.importance}
                onValueChange={(importance) =>
                  setForm({
                    ...form,
                    importance: importance as KanbanPriority,
                  })
                }
              >
                <SelectTrigger className="w-full min-w-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {KANBAN_PRIORITIES.map((priority) => (
                    <SelectItem key={priority} value={priority}>
                      {PROJECT_LEVEL_LABELS[priority]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          {form.platforms.length === 0 && (
            <p className="project-error text-sm">
              Selecciona al menos una plataforma.
            </p>
          )}
          {error && <p className="project-error text-sm">{error}</p>}
          <div className="flex justify-end">
            <Button disabled={isPending || form.platforms.length === 0}>
              {isPending ? 'Guardando…' : 'Guardar proyecto'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1 text-sm">
      <span>{label}</span>
      {children}
    </label>
  );
}

function initialForm(project: Project | null): ProjectForm {
  return {
    name: project?.name ?? '',
    status: project?.status ?? 'BACKLOG',
    platforms: project?.platforms ?? [],
    urgency: project?.urgency ?? 'MEDIA',
    importance: project?.importance ?? 'MEDIA',
  };
}
