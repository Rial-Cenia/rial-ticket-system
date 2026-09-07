'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MarkdownEditor } from '@/components/ui/markdown-editor';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  useCancelKanbanCard,
  useCreateKanbanCard,
  useUpdateKanbanCard,
} from '@/hooks/use-kanbans';
import {
  KANBAN_PRIORITIES,
  PRIORITY_LABELS,
  type Kanban,
  type KanbanCard,
} from '@/lib/types';

interface Props {
  kanban: Kanban;
  card: KanbanCard | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TaskCardModal({ kanban, card, open, onOpenChange }: Props) {
  const create = useCreateKanbanCard(kanban.id);
  const update = useUpdateKanbanCard(kanban.id);
  const cancel = useCancelKanbanCard(kanban.id);
  const [error, setError] = useState('');
  const [form, setForm] = useState(() => initialForm(kanban, card));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    const input = {
      ...form,
      assigneeUserId: form.assigneeUserId || null,
      reviewerUserId: form.reviewerUserId || null,
    };
    try {
      if (card) await update.mutateAsync({ cardId: card.id, input });
      else await create.mutateAsync(input);
      onOpenChange(false);
    } catch (mutationError) {
      setError(
        mutationError instanceof Error
          ? mutationError.message
          : 'No fue posible guardar',
      );
    }
  }

  async function remove() {
    if (!card || !window.confirm('¿Cancelar esta tarjeta?')) return;
    setError('');
    try {
      await cancel.mutateAsync(card.id);
      onOpenChange(false);
    } catch (mutationError) {
      setError(
        mutationError instanceof Error
          ? mutationError.message
          : 'No fue posible cancelar',
      );
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{card ? 'Editar tarjeta' : 'Nueva tarjeta'}</DialogTitle>
          <DialogDescription>{kanban.name}</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={submit}>
          <label className="block space-y-1 text-sm">
            <span>Título</span>
            <Input
              required
              maxLength={200}
              value={form.title}
              onChange={(event) =>
                setForm({ ...form, title: event.target.value })
              }
            />
          </label>
          <div className="space-y-1 text-sm">
            <label htmlFor="task-description">Descripción</label>
            <MarkdownEditor
              id="task-description"
              value={form.description}
              onChange={(description) => setForm({ ...form, description })}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Estado">
              <Select
                value={form.stateId}
                onValueChange={(stateId) => setForm({ ...form, stateId })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {kanban.states.map((state) => (
                    <SelectItem key={state.id} value={state.id}>
                      {state.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Prioridad">
              <Select
                value={form.priority}
                onValueChange={(priority) =>
                  setForm({
                    ...form,
                    priority: priority as typeof form.priority,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {KANBAN_PRIORITIES.map((priority) => (
                    <SelectItem key={priority} value={priority}>
                      {PRIORITY_LABELS[priority]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Encargado">
              <UserSelect
                value={form.assigneeUserId}
                onChange={(assigneeUserId) =>
                  setForm({ ...form, assigneeUserId })
                }
                kanban={kanban}
                staleUser={card?.assignee ?? null}
              />
            </Field>
            <Field label="Revisor">
              <UserSelect
                value={form.reviewerUserId}
                onChange={(reviewerUserId) =>
                  setForm({ ...form, reviewerUserId })
                }
                kanban={kanban}
                staleUser={card?.reviewer ?? null}
              />
            </Field>
          </div>
          <fieldset className="space-y-2">
            <legend className="text-sm">Etiquetas</legend>
            <div className="flex flex-wrap gap-2">
              {kanban.tags.length === 0 && (
                <span className="text-sm text-zinc-500">
                  Este kanban no tiene etiquetas.
                </span>
              )}
              {kanban.tags.map((tag) => (
                <label
                  key={tag.id}
                  className="flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={form.tagIds.includes(tag.id)}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        tagIds: event.target.checked
                          ? [...form.tagIds, tag.id]
                          : form.tagIds.filter((tagId) => tagId !== tag.id),
                      })
                    }
                  />
                  {tag.name}
                </label>
              ))}
            </div>
          </fieldset>
          {error && <p className="text-sm text-red-300">{error}</p>}
          <div className="flex justify-between gap-3">
            <div>
              {card && kanban.canDeleteCards && (
                <Button
                  type="button"
                  variant="danger"
                  onClick={remove}
                  disabled={cancel.isPending}
                >
                  Cancelar tarjeta
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
              >
                Cerrar
              </Button>
              <Button
                type="submit"
                disabled={create.isPending || update.isPending}
              >
                Guardar
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function initialForm(kanban: Kanban, card: KanbanCard | null) {
  return {
    title: card?.title ?? '',
    description: card?.description ?? '',
    stateId: card?.stateId ?? kanban.states[0]?.id ?? '',
    priority: card?.priority ?? ('MEDIA' as const),
    assigneeUserId: card?.assignee?.userId ?? '',
    reviewerUserId: card?.reviewer?.userId ?? '',
    tagIds: card?.tags.map((tag) => tag.id) ?? [],
  };
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1 text-sm">
      <span>{label}</span>
      {children}
    </div>
  );
}

function UserSelect({
  value,
  onChange,
  kanban,
  staleUser,
}: {
  value: string;
  onChange: (value: string) => void;
  kanban: Kanban;
  staleUser: KanbanCard['assignee'];
}) {
  const hasStaleUser = staleUser && !staleUser.isCurrentMember;
  return (
    <div className="space-y-1">
      <Select
        value={value || 'UNASSIGNED'}
        onValueChange={(next) => onChange(next === 'UNASSIGNED' ? '' : next)}
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="UNASSIGNED">Sin asignar</SelectItem>
          {hasStaleUser && (
            <SelectItem value={staleUser.userId}>
              {staleUser.name} — No pertenece al equipo
            </SelectItem>
          )}
          {kanban.members.map((member) => (
            <SelectItem key={member.userId} value={member.userId}>
              {member.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {hasStaleUser && value === staleUser.userId && (
        <p className="text-xs text-amber-300">
          Esta persona ya no pertenece a un equipo asignado al kanban.
        </p>
      )}
    </div>
  );
}
