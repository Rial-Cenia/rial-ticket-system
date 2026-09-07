'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { TaskBoard } from '@/components/tasks/task-board';
import { TaskCardModal } from '@/components/tasks/task-card-modal';
import { TaskTable } from '@/components/tasks/task-table';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useKanbans } from '@/hooks/use-kanbans';
import type { KanbanCard } from '@/lib/types';

export function TasksView({ mode }: { mode: 'kanban' | 'table' }) {
  const kanbans = useKanbans();
  const [selectedId, setSelectedId] = useState('');
  const [open, setOpen] = useState(false);
  const [selectedCard, setSelectedCard] = useState<KanbanCard | null>(null);
  const selected =
    kanbans.data?.find((kanban) => kanban.id === selectedId) ??
    kanbans.data?.[0];

  function openCard(card: KanbanCard | null) {
    setSelectedCard(card);
    setOpen(true);
  }

  if (kanbans.isLoading)
    return (
      <div className="h-72 animate-pulse rounded-xl border border-white/8 bg-white/4" />
    );
  if (kanbans.error)
    return (
      <p className="rounded-xl bg-red-500/10 p-4 text-red-300">
        {kanbans.error.message}
      </p>
    );
  if (!selected)
    return (
      <div className="rounded-xl border border-white/8 p-8 text-center">
        <h1 className="text-xl font-semibold">No tienes kanbans disponibles</h1>
        <p className="mt-2 text-sm text-zinc-500">
          Un administrador o jefe de equipo debe crear y asignar uno.
        </p>
      </div>
    );

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-1 text-xs uppercase tracking-wider text-zinc-500">
            Tareas · {mode === 'kanban' ? 'Kanban' : 'Tabla'}
          </p>
          <h1 className="text-2xl font-semibold">{selected.name}</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {selected.teams.map((team) => team.name).join(' · ')}
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={selected.id} onValueChange={setSelectedId}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {kanbans.data?.map((kanban) => (
                <SelectItem key={kanban.id} value={kanban.id}>
                  {kanban.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            onClick={() => openCard(null)}
            disabled={selected.states.length === 0}
          >
            <Plus className="size-4" /> Nueva tarjeta
          </Button>
        </div>
      </header>
      {mode === 'kanban' ? (
        <TaskBoard kanban={selected} onOpen={openCard} />
      ) : (
        <TaskTable kanban={selected} onOpen={openCard} />
      )}
      {open && (
        <TaskCardModal
          key={selectedCard?.id ?? 'new'}
          kanban={selected}
          card={selectedCard}
          open
          onOpenChange={setOpen}
        />
      )}
    </div>
  );
}
