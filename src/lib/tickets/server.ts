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

const TICKET_IMAGES_BUCKET = 'ticket-images';
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const IMAGE_EXTENSIONS = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
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

interface StoredImage {
  id: string;
  storagePath: string;
  fileName: string;
  mimeType: keyof typeof IMAGE_EXTENSIONS;
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

function validateDiscordAttachment(attachment: DiscordAttachment) {
  const mimeType = attachment.content_type as keyof typeof IMAGE_EXTENSIONS;
  if (!(mimeType in IMAGE_EXTENSIONS))
    throw new Error(`Formato de imagen no permitido: ${attachment.filename}`);
  if (attachment.size > MAX_IMAGE_BYTES)
    throw new Error(`La imagen ${attachment.filename} supera los 10 MB`);
  const url = new URL(attachment.url);
  if (url.protocol !== 'https:' || url.hostname !== 'cdn.discordapp.com')
    throw new Error('Discord entregó una URL de imagen inválida');
  return mimeType;
}

async function downloadDiscordAttachment(attachment: DiscordAttachment) {
  const mimeType = validateDiscordAttachment(attachment);
  const response = await fetch(attachment.url, {
    cache: 'no-store',
    redirect: 'error',
  });
  if (!response.ok)
    throw new Error(`No fue posible descargar ${attachment.filename}`);
  const responseType = response.headers.get('content-type')?.split(';')[0];
  if (responseType !== mimeType)
    throw new Error(
      `El contenido de ${attachment.filename} no es una imagen válida`,
    );
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_IMAGE_BYTES)
    throw new Error(`El tamaño de ${attachment.filename} no es válido`);
  return { bytes, mimeType };
}

async function uploadDiscordImages(
  publicId: string,
  attachments: DiscordAttachment[],
) {
  if (attachments.length > 5)
    throw new Error('Puedes adjuntar hasta 5 imágenes por ticket');

  const admin = createAdminClient();
  const uploaded: StoredImage[] = [];
  try {
    for (const attachment of attachments) {
      const { bytes, mimeType } = await downloadDiscordAttachment(attachment);
      const id = crypto.randomUUID();
      const storagePath = `${publicId}/${id}.${IMAGE_EXTENSIONS[mimeType]}`;
      const { error } = await admin.storage
        .from(TICKET_IMAGES_BUCKET)
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
        .from(TICKET_IMAGES_BUCKET)
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
    const images = await uploadDiscordImages(publicId, attachments);
    const admin = createAdminClient();
    const { data, error } = await admin.rpc('create_ticket_with_images', {
      p_public_id: publicId,
      p_title: input.title,
      p_description: input.description,
      p_type: input.type ?? 'REQUERIMIENTO',
      p_platform: input.platform ?? null,
      p_source: source,
      p_actor_name: actor.name,
      p_actor_id: actor.id,
      p_discord_id: actor.discordId ?? null,
      p_images: images,
    });
    if (error || !data) {
      await admin.storage
        .from(TICKET_IMAGES_BUCKET)
        .remove(images.map((image) => image.storagePath));
      return unwrapTicket(data, error);
    }
    return (await getTicket(publicId)) ?? unwrapTicket(data, null);
  }
  const { data, error } = await createAdminClient().rpc('create_ticket', {
    p_title: input.title,
    p_description: input.description,
    p_type: input.type ?? 'REQUERIMIENTO',
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
      .storage.from(TICKET_IMAGES_BUCKET)
      .remove(images.map((image) => image.storagePath));
    if (storageError)
      console.error('No fue posible limpiar imágenes del ticket');
  }
  return removed;
}

export async function getTicketImageSignedUrls(publicId: string) {
  const { data: images, error } = await createAdminClient()
    .from('TicketImage')
    .select('storagePath')
    .eq('ticketPublicId', publicId)
    .order('createdAt');
  if (error) throw new Error(error.message);
  if (!images?.length) return [];
  const { data: signed, error: signedError } = await createAdminClient()
    .storage.from(TICKET_IMAGES_BUCKET)
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
    .storage.from(TICKET_IMAGES_BUCKET)
    .download(image.storagePath);
  if (downloadError) throw new Error(downloadError.message);
  return { data, fileName: image.fileName, mimeType: image.mimeType };
}
