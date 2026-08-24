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
import { Input, Textarea } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useDeleteTicket, useUpdateTicket } from '@/hooks/use-tickets';
import {
  PLATFORM_LABELS,
  PLATFORMS,
  STATUS_LABELS,
  TICKET_STATUSES,
  TICKET_TYPES,
  TYPE_LABELS,
  type Platform,
  type Ticket,
  type TicketStatus,
  type TicketType,
} from '@/lib/types';

export function TicketDetailModal(props: {
  ticket: Ticket | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <TicketDetailModalForm
      key={props.ticket?.publicId ?? 'closed'}
      {...props}
    />
  );
}

function TicketDetailModalForm({
  ticket,
  onOpenChange,
}: {
  ticket: Ticket | null;
  onOpenChange: (open: boolean) => void;
}) {
  const update = useUpdateTicket();
  const remove = useDeleteTicket();
  const [form, setForm] = useState(ticket);
  if (!form) return null;

  async function save() {
    await update.mutateAsync({
      publicId: form!.publicId,
      patch: {
        title: form!.title,
        description: form!.description,
        type: form!.type,
        status: form!.status,
        platform: form!.platform,
      },
    });
    onOpenChange(false);
  }

  async function deleteCurrent() {
    if (!window.confirm('¿Eliminar definitivamente este ticket?')) return;
    await remove.mutateAsync(form!.publicId);
    onOpenChange(false);
  }

  const error = update.error ?? remove.error;
  return (
    <Dialog open={Boolean(ticket)} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Detalle del ticket</DialogTitle>
          <DialogDescription className="font-mono">
            {form.publicId}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <label className="block space-y-1.5 text-sm text-zinc-300">
            Título
            <Input
              value={form.title}
              onChange={(event) =>
                setForm({ ...form, title: event.target.value })
              }
            />
          </label>
          <label className="block space-y-1.5 text-sm text-zinc-300">
            Descripción
            <Textarea
              value={form.description}
              onChange={(event) =>
                setForm({ ...form, description: event.target.value })
              }
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="space-y-1.5 text-sm text-zinc-300">
              Tipo
              <Select
                value={form.type}
                onValueChange={(value) =>
                  setForm({ ...form, type: value as TicketType })
                }
              >
                <SelectTrigger className="w-full min-w-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TICKET_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {TYPE_LABELS[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <label className="space-y-1.5 text-sm text-zinc-300">
              Estado
              <Select
                value={form.status}
                onValueChange={(value) =>
                  setForm({ ...form, status: value as TicketStatus })
                }
              >
                <SelectTrigger className="w-full min-w-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TICKET_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {STATUS_LABELS[status]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <label className="space-y-1.5 text-sm text-zinc-300">
              Plataforma
              <Select
                value={form.platform ?? 'UNASSIGNED'}
                onValueChange={(value) =>
                  setForm({
                    ...form,
                    platform:
                      value === 'UNASSIGNED' ? null : (value as Platform),
                  })
                }
              >
                <SelectTrigger className="w-full min-w-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="UNASSIGNED">Sin asignar</SelectItem>
                  {PLATFORMS.map((platform) => (
                    <SelectItem key={platform} value={platform}>
                      {PLATFORM_LABELS[platform]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
          </div>
          {error && (
            <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {error.message}
            </p>
          )}
          <div className="flex justify-between gap-2">
            <Button
              variant="danger"
              onClick={deleteCurrent}
              disabled={remove.isPending}
            >
              Eliminar
            </Button>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button onClick={save} disabled={update.isPending}>
                {update.isPending ? 'Guardando…' : 'Guardar'}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
