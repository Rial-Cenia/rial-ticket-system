import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import type { DiscordAttachment } from '@/lib/discord/types';
import type { CreateTicketInput, UpdateTicketInput } from '@/lib/schemas';
import type {
  ActivitySource,
  Ticket,
  TicketFilters,
  TicketImage,
} from '@/lib/types';

const TICKET_ATTACHMENTS_BUCKET = 'ticket-images';
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const ATTACHMENT_FORMATS = {
  jpg: { mimeType: 'image/jpeg', acceptedMimeTypes: ['image/jpeg'] },
  jpeg: { mimeType: 'image/jpeg', acceptedMimeTypes: ['image/jpeg'] },
  png: { mimeType: 'image/png', acceptedMimeTypes: ['image/png'] },
  webp: { mimeType: 'image/webp', acceptedMimeTypes: ['image/webp'] },
  gif: { mimeType: 'image/gif', acceptedMimeTypes: ['image/gif'] },
  pdf: { mimeType: 'application/pdf', acceptedMimeTypes: ['application/pdf'] },
  xls: {
    mimeType: 'application/vnd.ms-excel',
    acceptedMimeTypes: ['application/vnd.ms-excel'],
  },
  xlsx: {
    mimeType:
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    acceptedMimeTypes: [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ],
  },
  doc: {
    mimeType: 'application/msword',
    acceptedMimeTypes: ['application/msword'],
  },
  docx: {
    mimeType:
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    acceptedMimeTypes: [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
  },
  md: {
    mimeType: 'text/markdown',
    acceptedMimeTypes: ['text/markdown', 'text/plain'],
  },
  markdown: {
    mimeType: 'text/markdown',
    acceptedMimeTypes: ['text/markdown', 'text/plain'],
  },
  icc: {
    mimeType: 'application/vnd.iccprofile',
    acceptedMimeTypes: [
      'application/vnd.iccprofile',
      'application/octet-stream',
    ],
  },
  py: {
    mimeType: 'text/x-python',
    acceptedMimeTypes: ['text/x-python', 'text/plain'],
  },
} as const;

interface Actor {
  id: string | null;
  name: string;
  discordId?: string | null;
}

function unwrapTicket(
  data: unknown,
  error: { message: string } | null,
): Ticket {
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Ticket not found');
  return serializeTicket(data);
}

interface TicketRow extends Omit<Ticket, 'images'> {
  TicketImage?: Array<Omit<TicketImage, 'url'>>;
}

interface StoredAttachment {
  id: string;
  storagePath: string;
  fileName: string;
  mimeType: string;
  size: number;
}

function serializeTicket(data: unknown): Ticket {
  const row = data as TicketRow;
  const { TicketImage: images = [], ...ticket } = row;
  return {
    ...ticket,
    images: images.map((image) => ({
      ...image,
      url: `/api/tickets/${ticket.publicId}/images/${image.id}`,
    })),
  };
}

function normalizedMimeType(value?: string) {
  return value?.split(';')[0].trim().toLowerCase();
}

function acceptsMimeType(
  format: { acceptedMimeTypes: readonly string[] },
  mimeType: string,
) {
  return format.acceptedMimeTypes.includes(mimeType);
}

function validateDiscordAttachment(attachment: DiscordAttachment) {
  const extension = attachment.filename.split('.').pop()?.toLowerCase();
  const format = extension
    ? ATTACHMENT_FORMATS[extension as keyof typeof ATTACHMENT_FORMATS]
    : undefined;
  const mimeType = normalizedMimeType(attachment.content_type);
  if (!format || !mimeType || !acceptsMimeType(format, mimeType))
    throw new Error(`Formato de archivo no permitido: ${attachment.filename}`);
  if (attachment.size > MAX_ATTACHMENT_BYTES)
    throw new Error(`El archivo ${attachment.filename} supera los 10 MB`);
  const url = new URL(attachment.url);
  if (url.protocol !== 'https:' || url.hostname !== 'cdn.discordapp.com')
    throw new Error('Discord entregó una URL de archivo adjunto inválida');
  return { extension, format };
}

async function downloadDiscordAttachment(attachment: DiscordAttachment) {
  const validated = validateDiscordAttachment(attachment);
  const response = await fetch(attachment.url, {
    cache: 'no-store',
    redirect: 'error',
  });
  if (!response.ok)
    throw new Error(`No fue posible descargar ${attachment.filename}`);
  const responseType = normalizedMimeType(
    response.headers.get('content-type') ?? undefined,
  );
  if (!responseType || !acceptsMimeType(validated.format, responseType))
    throw new Error(
      `El contenido de ${attachment.filename} no coincide con su formato`,
    );
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_ATTACHMENT_BYTES)
    throw new Error(`El tamaño de ${attachment.filename} no es válido`);
  return {
    bytes,
    extension: validated.extension,
    mimeType: validated.format.mimeType,
  };
}

async function uploadDiscordAttachments(
  publicId: string,
  attachments: DiscordAttachment[],
) {
  if (attachments.length > 5)
    throw new Error('Puedes adjuntar hasta 5 archivos por ticket');

  const admin = createAdminClient();
  const uploaded: StoredAttachment[] = [];
  try {
    for (const attachment of attachments) {
      const { bytes, extension, mimeType } =
        await downloadDiscordAttachment(attachment);
      const id = crypto.randomUUID();
      const storagePath = `${publicId}/${id}.${extension}`;
      const { error } = await admin.storage
        .from(TICKET_ATTACHMENTS_BUCKET)
        .upload(storagePath, bytes, {
          contentType: mimeType,
          upsert: false,
        });
      if (error) throw new Error(error.message);
      uploaded.push({
        id,
        storagePath,
        fileName: attachment.filename,
        mimeType,
        size: bytes.byteLength,
      });
    }
    return uploaded;
  } catch (error) {
    if (uploaded.length)
      await admin.storage
        .from(TICKET_ATTACHMENTS_BUCKET)
        .remove(uploaded.map((image) => image.storagePath));
    throw error;
  }
}

export async function listTickets(filters: TicketFilters = {}) {
  const admin = createAdminClient();
  let query = admin
    .from('Ticket')
    .select('*, TicketImage(id, fileName, mimeType, size, createdAt)')
    .order('updatedAt', { ascending: false });

  if (filters.status) query = query.eq('status', filters.status);
  if (filters.type) query = query.eq('type', filters.type);
  if (filters.unassignedOnly || filters.platform === 'UNASSIGNED')
    query = query.is('platform', null);
  else if (filters.platform) query = query.eq('platform', filters.platform);
  if (filters.search) {
    const search = filters.search.replace(/[,%()]/g, ' ').trim();
    if (search) {
      const code = /^RTP-(\d+)$/i.exec(search);
      query = code
        ? query.eq('id', Number(code[1]))
        : query.or(
            `title.ilike.%${search}%,description.ilike.%${search}%,createdByName.ilike.%${search}%`,
          );
    }
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).map(serializeTicket);
}

export async function getTicket(publicId: string) {
  const { data, error } = await createAdminClient()
    .from('Ticket')
    .select('*, TicketImage(id, fileName, mimeType, size, createdAt)')
    .eq('publicId', publicId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? serializeTicket(data) : null;
}

export async function createTicket(
  input: CreateTicketInput,
  source: ActivitySource,
  actor: Actor,
  attachments: DiscordAttachment[] = [],
) {
  if (attachments.length) {
    const publicId = crypto.randomUUID();
    const images = await uploadDiscordAttachments(publicId, attachments);
    const admin = createAdminClient();
    const { data, error } = await admin.rpc('create_ticket_with_images', {
      p_public_id: publicId,
      p_title: input.title,
      p_description: input.description,
      p_type: input.type ?? 'REQUERIMIENTO',
      p_priority: input.priority ?? 'MEDIA',
      p_platform: input.platform ?? null,
      p_source: source,
      p_actor_name: actor.name,
      p_actor_id: actor.id,
      p_discord_id: actor.discordId ?? null,
      p_images: images,
    });
    if (error || !data) {
      await admin.storage
        .from(TICKET_ATTACHMENTS_BUCKET)
        .remove(images.map((image) => image.storagePath));
      return unwrapTicket(data, error);
    }
    return (await getTicket(publicId)) ?? unwrapTicket(data, null);
  }
  const { data, error } = await createAdminClient().rpc('create_ticket', {
    p_title: input.title,
    p_description: input.description,
    p_type: input.type ?? 'REQUERIMIENTO',
    p_priority: input.priority ?? 'MEDIA',
    p_platform: input.platform ?? null,
    p_source: source,
    p_actor_name: actor.name,
    p_actor_id: actor.id,
    p_discord_id: actor.discordId ?? null,
  });
  return unwrapTicket(data, error);
}

export async function updateTicket(
  publicId: string,
  patch: UpdateTicketInput,
  source: ActivitySource,
  actor: Actor,
) {
  const { data, error } = await createAdminClient().rpc('update_ticket', {
    p_public_id: publicId,
    p_patch: patch,
    p_source: source,
    p_actor_name: actor.name,
    p_actor_id: actor.id,
  });
  const changed = unwrapTicket(data, error);
  return (await getTicket(publicId)) ?? changed;
}

export async function deleteTicket(publicId: string, actor: Actor) {
  const { data: images, error: imagesError } = await createAdminClient()
    .from('TicketImage')
    .select('storagePath')
    .eq('ticketPublicId', publicId);
  if (imagesError) throw new Error(imagesError.message);
  const { data, error } = await createAdminClient().rpc('delete_ticket', {
    p_public_id: publicId,
    p_source: 'WEB',
    p_actor_name: actor.name,
    p_actor_id: actor.id,
  });
  const removed = unwrapTicket(data, error);
  if (images?.length) {
    const { error: storageError } = await createAdminClient()
      .storage.from(TICKET_ATTACHMENTS_BUCKET)
      .remove(images.map((image) => image.storagePath));
    if (storageError)
      console.error('No fue posible limpiar adjuntos del ticket');
  }
  return removed;
}

export async function getTicketImageSignedUrls(publicId: string) {
  const { data: images, error } = await createAdminClient()
    .from('TicketImage')
    .select('storagePath')
    .eq('ticketPublicId', publicId)
    .like('mimeType', 'image/%')
    .order('createdAt');
  if (error) throw new Error(error.message);
  if (!images?.length) return [];
  const { data: signed, error: signedError } = await createAdminClient()
    .storage.from(TICKET_ATTACHMENTS_BUCKET)
    .createSignedUrls(
      images.map((image) => image.storagePath),
      60 * 60,
    );
  if (signedError) throw new Error(signedError.message);
  return signed
    .map((image) => image.signedUrl)
    .filter((url): url is string => Boolean(url));
}

export async function downloadTicketImage(publicId: string, imageId: string) {
  const { data: image, error } = await createAdminClient()
    .from('TicketImage')
    .select('storagePath, fileName, mimeType')
    .eq('id', imageId)
    .eq('ticketPublicId', publicId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!image) return null;
  const { data, error: downloadError } = await createAdminClient()
    .storage.from(TICKET_ATTACHMENTS_BUCKET)
    .download(image.storagePath);
  if (downloadError) throw new Error(downloadError.message);
  return { data, fileName: image.fileName, mimeType: image.mimeType };
}
