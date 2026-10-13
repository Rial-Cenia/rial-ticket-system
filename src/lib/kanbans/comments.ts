import 'server-only';
import type { AuthenticatedUser } from '@/lib/auth';
import { HttpError } from '@/lib/http';
import {
  getLeaderTeamIds,
  requireKanbanManager,
  requireKanbanMember,
} from '@/lib/kanbans/authorization';
import { createAdminClient } from '@/lib/supabase/admin';
import type { KanbanCardComment } from '@/lib/types';
import { listUserDirectory } from '@/lib/users/server';

const ATTACHMENTS_BUCKET = 'ticket-images';
const MAX_ATTACHMENTS = 5;
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

interface CommentAttachmentRow {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  createdAt: string;
}

interface CommentRow {
  id: string;
  kanbanCardId: string;
  content: string;
  createdByUserId: string;
  createdAt: string;
  KanbanCardCommentAttachment?: CommentAttachmentRow[];
}

interface StoredAttachment {
  id: string;
  storagePath: string;
  fileName: string;
  mimeType: string;
  size: number;
}

function normalizedMimeType(value: string) {
  return value.split(';')[0].trim().toLowerCase();
}

function validateAttachment(file: File) {
  const extension = file.name.split('.').pop()?.toLowerCase();
  const format = extension
    ? ATTACHMENT_FORMATS[extension as keyof typeof ATTACHMENT_FORMATS]
    : undefined;
  const mimeType = normalizedMimeType(file.type);
  if (
    !format ||
    !mimeType ||
    !(format.acceptedMimeTypes as readonly string[]).includes(mimeType)
  )
    throw new HttpError(`Formato de archivo no permitido: ${file.name}`, 400);
  if (file.size === 0 || file.size > MAX_ATTACHMENT_BYTES)
    throw new HttpError(`El tamaño de ${file.name} no es válido`, 400);
  return { extension, mimeType: format.mimeType };
}

async function requireActiveCard(kanbanId: string, cardId: string) {
  const { data, error } = await createAdminClient()
    .from('KanbanCard')
    .select('id')
    .eq('id', cardId)
    .eq('kanbanId', kanbanId)
    .eq('status', 'ACTIVE')
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new HttpError('Tarjeta no encontrada', 404);
}

async function canManageComments(actor: AuthenticatedUser, kanbanId: string) {
  const leaderTeamIds = await getLeaderTeamIds(actor);
  if (leaderTeamIds === null) return true;
  if (!leaderTeamIds.length) return false;
  const { data, error } = await createAdminClient()
    .from('KanbanTeam')
    .select('teamId')
    .eq('kanbanId', kanbanId)
    .eq('status', 'ACTIVE');
  if (error) throw new Error(error.message);
  return (data ?? []).some((team) =>
    leaderTeamIds.includes(team.teamId as string),
  );
}

function serializeComment(
  comment: CommentRow,
  actor: AuthenticatedUser,
  kanbanId: string,
  canManage: boolean,
  usersById: Map<string, { userId: string; name: string }>,
): KanbanCardComment {
  const author = usersById.get(comment.createdByUserId);
  return {
    id: comment.id,
    kanbanCardId: comment.kanbanCardId,
    content: comment.content,
    createdBy: author ?? {
      userId: comment.createdByUserId,
      name: 'Usuario eliminado',
    },
    createdAt: comment.createdAt,
    attachments: (comment.KanbanCardCommentAttachment ?? []).map(
      (attachment) => ({
        ...attachment,
        url: `/api/kanbans/${kanbanId}/cards/${comment.kanbanCardId}/comments/${comment.id}/attachments/${attachment.id}`,
      }),
    ),
    canDelete: canManage || comment.createdByUserId === actor.id,
  };
}

export async function listKanbanCardComments(
  actor: AuthenticatedUser,
  kanbanId: string,
  cardId: string,
) {
  await requireKanbanMember(actor, kanbanId);
  await requireActiveCard(kanbanId, cardId);
  const [canManage, users, commentsResult] = await Promise.all([
    canManageComments(actor, kanbanId),
    listUserDirectory(),
    createAdminClient()
      .from('KanbanCardComment')
      .select(
        'id, kanbanCardId, content, createdByUserId, createdAt, KanbanCardCommentAttachment(id, fileName, mimeType, size, createdAt)',
      )
      .eq('kanbanCardId', cardId)
      .order('createdAt'),
  ]);
  if (commentsResult.error) throw new Error(commentsResult.error.message);
  const usersById = new Map(users.map((user) => [user.userId, user]));
  return ((commentsResult.data ?? []) as unknown as CommentRow[]).map(
    (comment) =>
      serializeComment(comment, actor, kanbanId, canManage, usersById),
  );
}

export async function createKanbanCardComment(
  actor: AuthenticatedUser,
  kanbanId: string,
  cardId: string,
  content: string,
  attachments: File[],
) {
  await requireKanbanMember(actor, kanbanId);
  await requireActiveCard(kanbanId, cardId);
  if (!content && !attachments.length)
    throw new HttpError('Escribe un comentario o adjunta un archivo', 400);
  if (attachments.length > MAX_ATTACHMENTS)
    throw new HttpError('Puedes adjuntar hasta 5 archivos por comentario', 400);
  const validatedAttachments = attachments.map((file) => ({
    file,
    ...validateAttachment(file),
  }));
  const admin = createAdminClient();
  const { data: comment, error: commentError } = await admin
    .from('KanbanCardComment')
    .insert({ kanbanCardId: cardId, content, createdByUserId: actor.id })
    .select('id, kanbanCardId, content, createdByUserId, createdAt')
    .single();
  if (commentError) throw new Error(commentError.message);

  const uploaded: StoredAttachment[] = [];
  try {
    for (const attachment of validatedAttachments) {
      const id = crypto.randomUUID();
      const storagePath = `kanban-comments/${cardId}/${comment.id}/${id}.${attachment.extension}`;
      const { error } = await admin.storage
        .from(ATTACHMENTS_BUCKET)
        .upload(storagePath, attachment.file, {
          contentType: attachment.mimeType,
          upsert: false,
        });
      if (error) throw new Error(error.message);
      uploaded.push({
        id,
        storagePath,
        fileName: attachment.file.name,
        mimeType: attachment.mimeType,
        size: attachment.file.size,
      });
    }
    if (uploaded.length) {
      const { error } = await admin.from('KanbanCardCommentAttachment').insert(
        uploaded.map((attachment) => ({
          ...attachment,
          commentId: comment.id,
        })),
      );
      if (error) throw new Error(error.message);
    }
  } catch (error) {
    if (uploaded.length)
      await admin.storage
        .from(ATTACHMENTS_BUCKET)
        .remove(uploaded.map((attachment) => attachment.storagePath));
    await admin.from('KanbanCardComment').delete().eq('id', comment.id);
    throw error;
  }

  const usersById = new Map(
    (await listUserDirectory()).map((user) => [user.userId, user]),
  );
  return serializeComment(
    {
      ...comment,
      KanbanCardCommentAttachment: uploaded.map((attachment) => ({
        id: attachment.id,
        fileName: attachment.fileName,
        mimeType: attachment.mimeType,
        size: attachment.size,
        createdAt: comment.createdAt as string,
      })),
    } as CommentRow,
    actor,
    kanbanId,
    true,
    usersById,
  );
}

export async function deleteKanbanCardComment(
  actor: AuthenticatedUser,
  kanbanId: string,
  cardId: string,
  commentId: string,
) {
  await requireKanbanMember(actor, kanbanId);
  await requireActiveCard(kanbanId, cardId);
  const admin = createAdminClient();
  const { data: comment, error: commentError } = await admin
    .from('KanbanCardComment')
    .select('id, createdByUserId, KanbanCardCommentAttachment(storagePath)')
    .eq('id', commentId)
    .eq('kanbanCardId', cardId)
    .maybeSingle();
  if (commentError) throw new Error(commentError.message);
  if (!comment) throw new HttpError('Comentario no encontrado', 404);
  if (comment.createdByUserId !== actor.id)
    await requireKanbanManager(actor, kanbanId);
  const { error } = await admin
    .from('KanbanCardComment')
    .delete()
    .eq('id', commentId);
  if (error) throw new Error(error.message);
  const attachments = (comment.KanbanCardCommentAttachment ?? []) as Array<{
    storagePath: string;
  }>;
  if (attachments.length) {
    const { error: storageError } = await admin.storage
      .from(ATTACHMENTS_BUCKET)
      .remove(attachments.map((attachment) => attachment.storagePath));
    if (storageError)
      console.error('No fue posible limpiar adjuntos del comentario');
  }
  return { id: commentId };
}

export async function downloadKanbanCardCommentAttachment(
  actor: AuthenticatedUser,
  kanbanId: string,
  cardId: string,
  commentId: string,
  attachmentId: string,
) {
  await requireKanbanMember(actor, kanbanId);
  await requireActiveCard(kanbanId, cardId);
  const { data: attachment, error } = await createAdminClient()
    .from('KanbanCardCommentAttachment')
    .select(
      'storagePath, fileName, mimeType, KanbanCardComment!inner(kanbanCardId)',
    )
    .eq('id', attachmentId)
    .eq('commentId', commentId)
    .eq('KanbanCardComment.kanbanCardId', cardId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!attachment) return null;
  const { data, error: downloadError } = await createAdminClient()
    .storage.from(ATTACHMENTS_BUCKET)
    .download(attachment.storagePath as string);
  if (downloadError) throw new Error(downloadError.message);
  return {
    data,
    fileName: attachment.fileName as string,
    mimeType: attachment.mimeType as string,
  };
}
