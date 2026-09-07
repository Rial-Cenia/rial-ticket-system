'use client';

import { Badge } from '@/components/ui/badge';
import { PRIORITY_LABELS, type Kanban, type KanbanCard } from '@/lib/types';

export function TaskTable({
  kanban,
  onOpen,
}: {
  kanban: Kanban;
  onOpen: (card: KanbanCard) => void;
}) {
  const states = new Map(kanban.states.map((state) => [state.id, state.name]));
  return (
    <div className="overflow-x-auto rounded-xl border border-white/8">
      <table className="w-full min-w-[850px] text-left text-sm">
        <thead className="bg-white/5 text-xs uppercase text-zinc-500">
          <tr>
            <th className="px-4 py-3">Título</th>
            <th className="px-4 py-3">Estado</th>
            <th className="px-4 py-3">Prioridad</th>
            <th className="px-4 py-3">Encargado</th>
            <th className="px-4 py-3">Revisor</th>
            <th className="px-4 py-3">Etiquetas</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/8">
          {kanban.cards.map((card) => (
            <tr
              key={card.id}
              className="cursor-pointer hover:bg-white/4"
              onClick={() => onOpen(card)}
            >
              <td className="px-4 py-3 font-medium">{card.title}</td>
              <td className="px-4 py-3">{states.get(card.stateId)}</td>
              <td className="px-4 py-3">{PRIORITY_LABELS[card.priority]}</td>
              <UserCell user={card.assignee} />
              <UserCell user={card.reviewer} />
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-1">
                  {card.tags.map((tag) => (
                    <Badge
                      key={tag.id}
                      className="border-blue-400/20 bg-blue-500/10 text-blue-300"
                    >
                      {tag.name}
                    </Badge>
                  ))}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {kanban.cards.length === 0 && (
        <p className="p-8 text-center text-sm text-zinc-500">
          No hay tarjetas en este kanban.
        </p>
      )}
    </div>
  );
}

function UserCell({ user }: { user: KanbanCard['assignee'] }) {
  return (
    <td className="px-4 py-3">
      {user ? (
        <span className={user.isCurrentMember ? '' : 'text-amber-300'}>
          {user.name}
          {!user.isCurrentMember && ' · No pertenece al equipo'}
        </span>
      ) : (
        '—'
      )}
    </td>
  );
}
