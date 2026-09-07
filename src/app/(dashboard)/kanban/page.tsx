import { redirect } from 'next/navigation';

export default function LegacyKanbanPage() {
  redirect('/tickets/kanban');
}
