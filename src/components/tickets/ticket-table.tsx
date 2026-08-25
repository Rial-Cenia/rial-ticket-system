'use client';

import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ArrowUpDown } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  PlatformBadge,
  PriorityBadge,
  TypeBadge,
} from '@/components/tickets/ticket-badges';
import { Button } from '@/components/ui/button';
import { STATUS_LABELS, type Ticket } from '@/lib/types';
import { ticketCode } from '@/lib/tickets/format';

export function TicketTable({
  tickets,
  onOpen,
}: {
  tickets: Ticket[];
  onOpen: (ticket: Ticket) => void;
}) {
  'use no memo';

  const [sorting, setSorting] = useState<SortingState>([
    { id: 'updatedAt', desc: true },
  ]);
  const columns = useMemo<ColumnDef<Ticket>[]>(
    () => [
      {
        accessorKey: 'title',
        header: 'Ticket',
        cell: ({ row }) => (
          <div className="max-w-80 text-left">
            <span className="block font-medium text-zinc-100">
              {row.original.title}
            </span>
            <span className="block truncate text-xs text-zinc-600">
              {ticketCode(row.original)}
            </span>
          </div>
        ),
      },
      {
        accessorKey: 'type',
        header: 'Tipo',
        cell: ({ row }) => <TypeBadge type={row.original.type} />,
      },
      {
        accessorKey: 'priority',
        header: 'Prioridad',
        cell: ({ row }) => <PriorityBadge priority={row.original.priority} />,
      },
      {
        accessorKey: 'platform',
        header: 'Plataforma',
        cell: ({ row }) => <PlatformBadge platform={row.original.platform} />,
      },
      {
        accessorKey: 'status',
        header: 'Estado',
        cell: ({ row }) => STATUS_LABELS[row.original.status],
      },
      { accessorKey: 'createdByName', header: 'Creador' },
      {
        accessorKey: 'updatedAt',
        header: 'Actualizado',
        cell: ({ row }) =>
          format(new Date(row.original.updatedAt), 'd MMM yyyy, HH:mm', {
            locale: es,
          }),
      },
    ],
    [],
  );
  const table = useReactTable({
    data: tickets,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="overflow-x-auto rounded-xl border border-white/8 bg-zinc-900/60">
      <table className="w-full min-w-[900px] text-sm">
        <thead className="border-b border-white/8 bg-white/3 text-left text-xs uppercase tracking-wide text-zinc-500">
          {table.getHeaderGroups().map((group) => (
            <tr key={group.id}>
              {group.headers.map((header) => (
                <th key={header.id} className="px-4 py-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="-ml-3 h-7 text-xs uppercase text-zinc-500"
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    {flexRender(
                      header.column.columnDef.header,
                      header.getContext(),
                    )}
                    <ArrowUpDown className="size-3" />
                  </Button>
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr
              key={row.id}
              tabIndex={0}
              className="cursor-pointer border-b border-white/6 text-zinc-400 outline-none last:border-0 hover:bg-white/3 focus-visible:bg-white/5 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-400"
              onClick={() => onOpen(row.original)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onOpen(row.original);
                }
              }}
            >
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="px-4 py-3">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
          {tickets.length === 0 && (
            <tr>
              <td
                colSpan={columns.length}
                className="py-16 text-center text-zinc-600"
              >
                No hay tickets para estos filtros.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
