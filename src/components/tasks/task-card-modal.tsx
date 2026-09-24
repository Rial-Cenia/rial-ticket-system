'use client';

import { Maximize2, Minimize2, Pencil } from 'lucide-react';
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  MarkdownContent,
  MarkdownEditor,
} from '@/components/ui/markdown-editor';
import { useToast } from '@/components/ui/toast';
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
  useTransferKanbanCard,
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
  const transfer = useTransferKanbanCard(kanban.id);
  const { showToast } = useToast();
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(card === null);
  const [fullscreen, setFullscreen] = useState(false);
  const [form, setForm] = useState(() => initialForm(kanban, card));
  const [targetKanbanId, setTargetKanbanId] = useState(
    kanban.outgoingConnections?.[0]?.targetKanbanId ?? '',
  );
  const outgoingConnections = kanban.outgoingConnections ?? [];

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
      showToast({
        variant: 'success',
        message: card
          ? 'Tarjeta actualizada correctamente.'
          : 'Tarjeta creada correctamente.',
      });
      onOpenChange(false);
    } catch (mutationError) {
      const message =
        mutationError instanceof Error
          ? mutationError.message
          : 'No fue posible guardar.';
      setError(message);
      showToast({ variant: 'error', message });
    }
  }

  async function remove() {
    if (!card || !window.confirm('¿Cancelar esta tarjeta?')) return;
    setError('');
    try {
      await cancel.mutateAsync(card.id);
      showToast({
        variant: 'success',
        message: 'Tarjeta cancelada correctamente.',
      });
      onOpenChange(false);
    } catch (mutationError) {
      const message =
        mutationError instanceof Error
          ? mutationError.message
          : 'No fue posible cancelar.';
      setError(message);
      showToast({ variant: 'error', message });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={
          fullscreen
            ? 'h-[100dvh] max-h-none w-full max-w-none rounded-none p-6 sm:p-10'
            : 'max-w-3xl'
        }
      >
        {editing ? (
          <>
            <DialogHeader>
              <DialogTitle>
                {card ? 'Editar tarjeta' : 'Nueva tarjeta'}
              </DialogTitle>
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
              {card &&
                kanban.states.at(-1)?.id === card.stateId &&
                outgoingConnections.length > 0 && (
                  <div className="rounded-lg border border-indigo-400/20 bg-indigo-500/5 p-3">
                    <p className="mb-2 text-sm text-zinc-300">
                      Pasar al siguiente kanban
                    </p>
                    <div className="flex gap-2">
                      <Select
                        value={targetKanbanId}
                        onValueChange={setTargetKanbanId}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {outgoingConnections.map((connection) => (
                            <SelectItem
                              key={connection.targetKanbanId}
                              value={connection.targetKanbanId}
                            >
                              {connection.targetKanbanName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={transfer.isPending}
                        onClick={async () => {
                          await transfer.mutateAsync({
                            cardId: card.id,
                            targetKanbanId,
                          });
                          onOpenChange(false);
                        }}
                      >
                        Pasar tarjeta
                      </Button>
                    </div>
                  </div>
                )}
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
          </>
        ) : (
          <TaskCardPreview
            card={card!}
            kanban={kanban}
            fullscreen={fullscreen}
            onToggleFullscreen={() => setFullscreen((value) => !value)}
            onEdit={() => {
              setFullscreen(false);
              setEditing(true);
            }}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function TaskCardPreview({
  card,
  kanban,
  fullscreen,
  onToggleFullscreen,
  onEdit,
  onClose,
}: {
  card: KanbanCard;
  kanban: Kanban;
  fullscreen: boolean;
  onToggleFullscreen: () => void;
  onEdit: () => void;
  onClose: () => void;
}) {
  const state = kanban.states.find(
    (candidate) => candidate.id === card.stateId,
  );
  return (
    <div className="flex min-h-full flex-col">
      <DialogHeader className="pr-20">
        <DialogTitle>{card.title}</DialogTitle>
        <DialogDescription>{kanban.name}</DialogDescription>
      </DialogHeader>
      <div className="absolute right-14 top-4 flex gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={
            fullscreen
              ? 'Salir de pantalla completa'
              : 'Ver en pantalla completa'
          }
          title={
            fullscreen
              ? 'Salir de pantalla completa'
              : 'Ver en pantalla completa'
          }
          onClick={onToggleFullscreen}
        >
          {fullscreen ? (
            <Minimize2 className="size-4" />
          ) : (
            <Maximize2 className="size-4" />
          )}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Editar tarjeta"
          title="Editar tarjeta"
          onClick={onEdit}
        >
          <Pencil className="size-4" />
        </Button>
      </div>
      <div className="flex-1 space-y-6 overflow-y-auto pr-1">
        <div className="flex flex-wrap gap-2">
          <Badge>{PRIORITY_LABELS[card.priority]}</Badge>
          {state && <Badge>{state.name}</Badge>}
          {card.tags.map((tag) => (
            <Badge
              key={tag.id}
              className="border-blue-400/20 bg-blue-500/10 text-blue-300"
            >
              {tag.name}
            </Badge>
          ))}
        </div>
        <section className="rounded-xl border border-white/8 bg-black/20 p-5">
          {card.description ? (
            <MarkdownContent>{card.description}</MarkdownContent>
          ) : (
            <p className="text-sm text-zinc-500">Sin descripción.</p>
          )}
        </section>
        <dl className="grid gap-3 rounded-xl border border-white/8 bg-black/20 p-4 text-sm sm:grid-cols-2">
          <PreviewMetadata
            label="Encargado"
            value={card.assignee?.name ?? 'Sin asignar'}
          />
          <PreviewMetadata
            label="Revisor"
            value={card.reviewer?.name ?? 'Sin asignar'}
          />
          <PreviewMetadata label="Creada" value={formatDate(card.createdAt)} />
          <PreviewMetadata
            label="Última actualización"
            value={formatDate(card.updatedAt)}
          />
        </dl>
      </div>
      <div className="mt-6 flex justify-end gap-2 border-t border-white/8 pt-4">
        <Button type="button" variant="ghost" onClick={onClose}>
          Cerrar
        </Button>
        <Button type="button" onClick={onEdit}>
          <Pencil className="size-4" /> Editar tarjeta
        </Button>
      </div>
    </div>
  );
}

function PreviewMetadata({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-zinc-500">{label}</dt>
      <dd className="mt-1 text-zinc-200">{value}</dd>
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('es-CL', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
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
