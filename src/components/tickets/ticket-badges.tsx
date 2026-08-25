import { Badge } from '@/components/ui/badge';
import {
  PLATFORM_LABELS,
  PRIORITY_LABELS,
  TYPE_LABELS,
  type Ticket,
} from '@/lib/types';
import { cn } from '@/lib/utils';

const colors: Record<Ticket['type'], string> = {
  BUG: 'border-red-400/20 bg-red-500/12 text-red-300',
  MEJORA: 'border-blue-400/20 bg-blue-500/12 text-blue-300',
  REQUERIMIENTO: 'border-emerald-400/20 bg-emerald-500/12 text-emerald-300',
  DUDA: 'border-purple-400/20 bg-purple-500/12 text-purple-300',
};

export function TypeBadge({ type }: Pick<Ticket, 'type'>) {
  return <Badge className={colors[type]}>{TYPE_LABELS[type]}</Badge>;
}

const priorityColors: Record<Ticket['priority'], string> = {
  BAJA: 'border-emerald-400/20 bg-emerald-500/12 text-emerald-300',
  MEDIA: 'border-blue-400/20 bg-blue-500/12 text-blue-300',
  ALTA: 'border-orange-400/20 bg-orange-500/12 text-orange-300',
  CRITICA: 'border-red-400/20 bg-red-500/12 text-red-300',
};

export function PriorityBadge({ priority }: Pick<Ticket, 'priority'>) {
  return (
    <Badge className={priorityColors[priority]}>
      {PRIORITY_LABELS[priority]}
    </Badge>
  );
}

export function PlatformBadge({ platform }: Pick<Ticket, 'platform'>) {
  return platform ? (
    <Badge>{PLATFORM_LABELS[platform]}</Badge>
  ) : (
    <Badge
      className={cn(
        'border-amber-400/20 bg-amber-500/12 text-amber-300 animate-pulse-soft',
      )}
    >
      Pendiente Barbilla Roja
    </Badge>
  );
}
