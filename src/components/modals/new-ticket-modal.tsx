'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch } from 'react-hook-form';
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
import { useCreateTicket } from '@/hooks/use-tickets';
import { createTicketSchema, type CreateTicketInput } from '@/lib/schemas';
import {
  PRIORITY_LABELS,
  TICKET_PRIORITIES,
  TICKET_TYPES,
  TYPE_LABELS,
} from '@/lib/types';

export function NewTicketModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const mutation = useCreateTicket();
  const form = useForm<CreateTicketInput>({
    resolver: zodResolver(createTicketSchema),
    defaultValues: {
      title: '',
      description: '',
      type: 'REQUERIMIENTO',
      priority: 'MEDIA',
      platform: null,
    },
  });
  const type = useWatch({ control: form.control, name: 'type' });
  const priority = useWatch({ control: form.control, name: 'priority' });

  async function submit(input: CreateTicketInput) {
    await mutation.mutateAsync(input);
    form.reset();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo ticket</DialogTitle>
          <DialogDescription>
            El ticket se enviará también al canal de triage en Discord.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={form.handleSubmit(submit)}>
          <label className="block space-y-1.5 text-sm text-zinc-300">
            Título
            <Input
              {...form.register('title')}
              placeholder="Resumen breve del problema"
            />
            {form.formState.errors.title && (
              <span className="text-xs text-red-300">
                {form.formState.errors.title.message}
              </span>
            )}
          </label>
          <label className="block space-y-1.5 text-sm text-zinc-300">
            Descripción
            <Textarea
              {...form.register('description')}
              placeholder="Incluye el contexto necesario para resolverlo"
            />
            {form.formState.errors.description && (
              <span className="text-xs text-red-300">
                {form.formState.errors.description.message}
              </span>
            )}
          </label>
          <label className="block space-y-1.5 text-sm text-zinc-300">
            Tipo
            <Select
              value={type}
              onValueChange={(value) =>
                form.setValue('type', value as CreateTicketInput['type'])
              }
            >
              <SelectTrigger className="w-full">
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
          <label className="block space-y-1.5 text-sm text-zinc-300">
            Prioridad
            <Select
              value={priority}
              onValueChange={(value) =>
                form.setValue(
                  'priority',
                  value as CreateTicketInput['priority'],
                )
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TICKET_PRIORITIES.map((priority) => (
                  <SelectItem key={priority} value={priority}>
                    {PRIORITY_LABELS[priority]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          {mutation.error && (
            <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {mutation.error.message}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button disabled={mutation.isPending}>
              {mutation.isPending ? 'Creando…' : 'Crear ticket'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
