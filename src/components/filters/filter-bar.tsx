'use client';

import { Search, SlidersHorizontal } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  PLATFORM_LABELS,
  PLATFORMS,
  TICKET_TYPES,
  TYPE_LABELS,
  type TicketFilters,
} from '@/lib/types';

export function FilterBar({
  filters,
  onChange,
}: {
  filters: TicketFilters;
  onChange: (filters: TicketFilters) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-white/8 bg-zinc-900/60 p-3">
      <SlidersHorizontal className="size-4 text-zinc-500" />
      <Select
        value={filters.platform ?? 'ALL'}
        onValueChange={(value) =>
          onChange({
            ...filters,
            platform:
              value === 'ALL'
                ? undefined
                : (value as TicketFilters['platform']),
          })
        }
      >
        <SelectTrigger>
          <SelectValue placeholder="Plataforma" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">Todas las plataformas</SelectItem>
          <SelectItem value="UNASSIGNED">Pendiente Barbilla Roja</SelectItem>
          {PLATFORMS.map((platform) => (
            <SelectItem key={platform} value={platform}>
              {PLATFORM_LABELS[platform]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={filters.type ?? 'ALL'}
        onValueChange={(value) =>
          onChange({
            ...filters,
            type:
              value === 'ALL' ? undefined : (value as TicketFilters['type']),
          })
        }
      >
        <SelectTrigger>
          <SelectValue placeholder="Tipo" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">Todos los tipos</SelectItem>
          {TICKET_TYPES.map((type) => (
            <SelectItem key={type} value={type}>
              {TYPE_LABELS[type]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <label className="relative min-w-56 flex-1">
        <Search className="absolute left-3 top-3 size-4 text-zinc-600" />
        <Input
          className="pl-9"
          value={filters.search ?? ''}
          onChange={(event) =>
            onChange({ ...filters, search: event.target.value || undefined })
          }
          placeholder="Buscar título, descripción o creador"
        />
      </label>
      <label className="flex items-center gap-2 rounded-lg border border-white/8 px-3 py-2 text-sm text-zinc-400">
        <input
          type="checkbox"
          checked={filters.unassignedOnly ?? false}
          onChange={(event) =>
            onChange({ ...filters, unassignedOnly: event.target.checked })
          }
          className="accent-blue-500"
        />
        Solo triage
      </label>
    </div>
  );
}
