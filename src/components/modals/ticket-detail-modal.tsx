'use client';

import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  ExternalLink,
  MessageSquareText,
  Paperclip,
  Pencil,
} from 'lucide-react';
import Image from 'next/image';
import { useState } from 'react';
import { PlatformBadge, TypeBadge } from '@/components/tickets/ticket-badges';
import { Badge } from '@/components/ui/badge';
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
import {
  useDeleteTicket,
  useDiscordConversation,
  useUpdateTicket,
} from '@/hooks/use-tickets';
import {
  PLATFORM_LABELS,
  PLATFORMS,
  STATUS_LABELS,
  TICKET_STATUSES,
  TICKET_TYPES,
  TYPE_LABELS,
  type DiscordConversation,
  type Platform,
  type Ticket,
  type TicketStatus,
  type TicketType,
} from '@/lib/types';
import { ticketCode } from '@/lib/tickets/format';

export function TicketDetailModal(props: {
  ticket: Ticket | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <TicketDetailModalContent
      key={props.ticket?.publicId ?? 'closed'}
      {...props}
    />
  );
}

function TicketDetailModalContent({
  ticket,
  onOpenChange,
}: {
  ticket: Ticket | null;
  onOpenChange: (open: boolean) => void;
}) {
  const update = useUpdateTicket();
  const remove = useDeleteTicket();
  const conversation = useDiscordConversation(ticket);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(ticket);
  if (!form) return null;

  async function save() {
    const saved = await update.mutateAsync({
      publicId: form!.publicId,
      patch: {
        title: form!.title,
        description: form!.description,
        type: form!.type,
        status: form!.status,
        platform: form!.platform,
      },
    });
    setForm(saved);
    setEditing(false);
  }

  async function deleteCurrent() {
    if (!window.confirm('¿Eliminar definitivamente este ticket?')) return;
    await remove.mutateAsync(form!.publicId);
    onOpenChange(false);
  }

  function cancelEditing() {
    setForm(ticket);
    setEditing(false);
  }

  const error = update.error ?? remove.error;
  return (
    <Dialog open={Boolean(ticket)} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader className="pr-16">
          <div className="flex items-start justify-between gap-4">
            <div>
              <DialogTitle>Detalle del ticket</DialogTitle>
              <DialogDescription className="mt-1 font-mono text-indigo-400">
                {ticketCode(form)}
              </DialogDescription>
            </div>
            {!editing && (
              <Button
                variant="ghost"
                size="icon"
                aria-label="Editar ticket"
                onClick={() => setEditing(true)}
              >
                <Pencil className="size-4" />
              </Button>
            )}
          </div>
        </DialogHeader>

        {editing ? (
          <TicketEditForm
            form={form}
            setForm={setForm}
            error={error}
            isSaving={update.isPending}
            isDeleting={remove.isPending}
            onSave={save}
            onCancel={cancelEditing}
            onDelete={deleteCurrent}
          />
        ) : (
          <TicketOverview
            ticket={form}
            conversation={conversation.data}
            conversationLoading={conversation.isLoading}
            conversationError={conversation.error}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function TicketOverview({
  ticket,
  conversation,
  conversationLoading,
  conversationError,
}: {
  ticket: Ticket;
  conversation?: DiscordConversation;
  conversationLoading: boolean;
  conversationError: Error | null;
}) {
  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <TypeBadge type={ticket.type} />
          <PlatformBadge platform={ticket.platform} />
          <Badge>{STATUS_LABELS[ticket.status]}</Badge>
        </div>
        <h2 className="text-xl font-semibold text-white">{ticket.title}</h2>
        <p className="whitespace-pre-wrap text-sm leading-6 text-zinc-300">
          {ticket.description}
        </p>
      </section>

      <dl className="grid gap-3 rounded-xl border border-white/8 bg-black/20 p-4 text-sm sm:grid-cols-3">
        <Metadata label="Creado por" value={ticket.createdByName} />
        <Metadata label="Creado" value={formatDate(ticket.createdAt)} />
        <Metadata
          label="Última actualización"
          value={formatDate(ticket.updatedAt)}
        />
      </dl>

      <TicketImages ticket={ticket} />

      {ticket.discordThreadId ? (
        <DiscordConversationSection
          conversation={conversation}
          loading={conversationLoading}
          error={conversationError}
        />
      ) : (
        <section className="rounded-xl border border-dashed border-white/10 p-4 text-sm text-zinc-500">
          Este ticket todavía no tiene un chat sincronizado en Discord.
        </section>
      )}
    </div>
  );
}

function TicketImages({ ticket }: { ticket: Ticket }) {
  if (!ticket.images.length) return null;
  return (
    <section className="space-y-2" aria-labelledby="ticket-images-title">
      <h3
        id="ticket-images-title"
        className="text-sm font-medium text-zinc-300"
      >
        Imágenes ({ticket.images.length})
      </h3>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {ticket.images.map((image) => (
          <a
            key={image.id}
            href={image.url}
            target="_blank"
            rel="noreferrer"
            className="overflow-hidden rounded-lg border border-white/10 bg-zinc-950"
          >
            <Image
              src={image.url}
              alt={image.fileName}
              width={640}
              height={480}
              unoptimized
              className="aspect-4/3 h-auto w-full object-cover transition hover:scale-105"
            />
          </a>
        ))}
      </div>
    </section>
  );
}

function DiscordConversationSection({
  conversation,
  loading,
  error,
}: {
  conversation?: DiscordConversation;
  loading: boolean;
  error: Error | null;
}) {
  return (
    <section className="space-y-3" aria-labelledby="discord-chat-title">
      <div className="flex items-center justify-between gap-3">
        <h3
          id="discord-chat-title"
          className="flex items-center gap-2 text-sm font-medium text-zinc-300"
        >
          <MessageSquareText className="size-4 text-indigo-400" />
          Chat de Discord
        </h3>
        {conversation && (
          <Button asChild variant="outline" size="sm">
            <a href={conversation.threadUrl} target="_blank" rel="noreferrer">
              Abrir en Discord
              <ExternalLink className="size-3.5" />
            </a>
          </Button>
        )}
      </div>

      <div className="max-h-80 space-y-3 overflow-y-auto rounded-xl border border-white/8 bg-black/25 p-4">
        {loading && (
          <p className="text-sm text-zinc-500">Cargando conversación…</p>
        )}
        {error && (
          <p className="text-sm text-red-300">
            No fue posible cargar el chat de Discord: {error.message}
          </p>
        )}
        {conversation?.messages.map((message) => (
          <article key={message.id} className="space-y-1.5">
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="text-sm font-medium text-zinc-200">
                {message.authorName}
              </span>
              {message.isBot && <Badge>Bot</Badge>}
              <time
                className="text-xs text-zinc-600"
                dateTime={message.createdAt}
              >
                {formatDate(message.createdAt)}
              </time>
            </div>
            {message.content && (
              <p className="whitespace-pre-wrap text-sm leading-5 text-zinc-400">
                {message.content}
              </p>
            )}
            {message.attachments.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {message.attachments.map((attachment) => (
                  <a
                    key={attachment.id}
                    href={attachment.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-md border border-white/10 px-2 py-1 text-xs text-indigo-300 hover:bg-white/5"
                  >
                    <Paperclip className="size-3" />
                    {attachment.fileName}
                  </a>
                ))}
              </div>
            )}
          </article>
        ))}
        {conversation && conversation.messages.length === 0 && (
          <p className="text-sm text-zinc-500">
            El hilo todavía no tiene mensajes.
          </p>
        )}
      </div>
    </section>
  );
}

function TicketEditForm({
  form,
  setForm,
  error,
  isSaving,
  isDeleting,
  onSave,
  onCancel,
  onDelete,
}: {
  form: Ticket;
  setForm: (ticket: Ticket) => void;
  error: Error | null;
  isSaving: boolean;
  isDeleting: boolean;
  onSave: () => void;
  onCancel: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="space-y-4">
      <label className="block space-y-1.5 text-sm text-zinc-300">
        Título
        <Input
          value={form.title}
          onChange={(event) => setForm({ ...form, title: event.target.value })}
        />
      </label>
      <TicketImages ticket={form} />
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
                platform: value === 'UNASSIGNED' ? null : (value as Platform),
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
        <Button variant="danger" onClick={onDelete} disabled={isDeleting}>
          Eliminar
        </Button>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
          <Button onClick={onSave} disabled={isSaving}>
            {isSaving ? 'Guardando…' : 'Guardar'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Metadata({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-zinc-600">{label}</dt>
      <dd className="mt-1 text-zinc-300">{value}</dd>
    </div>
  );
}

function formatDate(value: string) {
  return format(new Date(value), 'd MMM yyyy, HH:mm', { locale: es });
}
