'use client';

import { FileIcon, Paperclip, Reply, Send, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { MarkdownContent } from '@/components/ui/markdown-editor';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import {
  useCreateKanbanCardComment,
  useDeleteKanbanCardComment,
  useKanbanCardComments,
} from '@/hooks/use-kanbans';
import type { KanbanCardComment } from '@/lib/types';
import { useToast } from '@/components/ui/toast';

const ACCEPTED_FILES = [
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.gif',
  '.pdf',
  '.xls',
  '.xlsx',
  '.doc',
  '.docx',
  '.md',
  '.markdown',
  '.icc',
  '.py',
].join(',');

interface Props {
  kanbanId: string;
  cardId: string;
  description: string;
}

export function KanbanCardComments({ kanbanId, cardId, description }: Props) {
  const comments = useKanbanCardComments(kanbanId, cardId);
  const create = useCreateKanbanCardComment(kanbanId, cardId);
  const remove = useDeleteKanbanCardComment(kanbanId, cardId);
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [content, setContent] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [anchorText, setAnchorText] = useState<string | null>(null);
  const descriptionRef = useRef<HTMLDivElement>(null);
  const threads = createCommentThreads(comments.data ?? []);

  function selectAnchor() {
    const selection = window.getSelection();
    const selectedText = selection?.toString().trim();
    if (
      !selectedText ||
      !selection?.anchorNode ||
      !descriptionRef.current?.contains(selection.anchorNode)
    )
      return;
    setReplyingTo(null);
    setAnchorText(selectedText.slice(0, 1000));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    const formData = new FormData();
    formData.set('content', content);
    if (replyingTo) formData.set('parentCommentId', replyingTo);
    if (anchorText && !replyingTo) formData.set('anchorText', anchorText);
    files.forEach((file) => formData.append('attachments', file));
    try {
      await create.mutateAsync(formData);
      setContent('');
      setFiles([]);
      setReplyingTo(null);
      setAnchorText(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (mutationError) {
      const message =
        mutationError instanceof Error
          ? mutationError.message
          : 'No fue posible publicar el comentario.';
      setError(message);
      showToast({ variant: 'error', message });
    }
  }

  async function deleteComment(commentId: string) {
    if (!window.confirm('¿Eliminar este comentario?')) return;
    try {
      await remove.mutateAsync(commentId);
    } catch (mutationError) {
      const message =
        mutationError instanceof Error
          ? mutationError.message
          : 'No fue posible eliminar el comentario.';
      showToast({ variant: 'error', message });
    }
  }

  return (
    <section className="space-y-6">
      <div className="rounded-xl border border-white/8 bg-black/20 p-5">
        <h3 className="mb-3 text-sm font-medium">Descripción</h3>
        <div ref={descriptionRef} onMouseUp={selectAnchor}>
          {description ? (
            <MarkdownContent>{description}</MarkdownContent>
          ) : (
            <p className="text-sm text-zinc-500">Sin descripción.</p>
          )}
        </div>
        <p className="mt-3 text-xs text-zinc-500">
          Selecciona una o más líneas para comentarlas directamente.
        </p>
      </div>
      <div className="space-y-4 border-t border-white/8 pt-6">
        <div>
          <h3 className="text-sm font-medium">Comentarios</h3>
          <p className="mt-1 text-xs text-zinc-500">
            Usa Markdown para compartir links y contexto.
          </p>
        </div>
        {!replyingTo && (
          <CommentComposer
            content={content}
            files={files}
            fileInputRef={fileInputRef}
            isPending={create.isPending}
            error={error}
            anchorText={anchorText}
            onContentChange={setContent}
            onFilesChange={setFiles}
            onSubmit={submit}
            onClearAnchor={() => setAnchorText(null)}
          />
        )}
        {comments.isLoading && (
          <p className="text-sm text-zinc-500">Cargando comentarios…</p>
        )}
        {comments.error && (
          <p className="text-sm text-red-300">{comments.error.message}</p>
        )}
        {comments.data?.length === 0 && (
          <p className="text-sm text-zinc-500">Aún no hay comentarios.</p>
        )}
        <div className="space-y-3">
          {threads.map((thread) => (
            <CommentThread
              key={thread.comment.id}
              thread={thread}
              deletingComment={remove.isPending}
              onDelete={deleteComment}
              onReply={setReplyingTo}
              replyingTo={replyingTo}
              onCancelReply={() => setReplyingTo(null)}
              composer={{
                content,
                files,
                fileInputRef,
                isPending: create.isPending,
                error,
                onContentChange: setContent,
                onFilesChange: setFiles,
                onSubmit: submit,
              }}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

interface CommentThreadNode {
  comment: KanbanCardComment;
  replies: CommentThreadNode[];
}

function createCommentThreads(comments: KanbanCardComment[]) {
  const nodes = new Map<string, CommentThreadNode>(
    comments.map<[string, CommentThreadNode]>((comment) => [
      comment.id,
      { comment, replies: [] } satisfies CommentThreadNode,
    ]),
  );
  const roots: CommentThreadNode[] = [];

  for (const node of nodes.values()) {
    const parent = node.comment.parentCommentId
      ? nodes.get(node.comment.parentCommentId)
      : null;
    if (parent) parent.replies.push(node);
    else roots.push(node);
  }

  return roots;
}

function CommentThread({
  thread,
  deletingComment,
  onDelete,
  onReply,
  replyingTo,
  onCancelReply,
  composer,
}: {
  thread: CommentThreadNode;
  deletingComment: boolean;
  onDelete: (commentId: string) => void;
  onReply: (commentId: string) => void;
  replyingTo: string | null;
  onCancelReply: () => void;
  composer: ComposerProps;
}) {
  const { comment, replies } = thread;
  return (
    <article
      data-testid={`comment-${comment.id}`}
      className="rounded-xl border border-white/8 bg-black/20 p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-zinc-100">
            {comment.createdBy.name}
          </p>
          <p className="text-xs text-zinc-500">
            {formatDate(comment.createdAt)}
          </p>
        </div>
        {comment.canDelete && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Eliminar comentario"
            title="Eliminar comentario"
            disabled={deletingComment}
            onClick={() => onDelete(comment.id)}
          >
            <Trash2 className="size-4" />
          </Button>
        )}
      </div>
      {comment.content && (
        <div className="mt-3">
          <MarkdownContent>{comment.content}</MarkdownContent>
        </div>
      )}
      {comment.anchorText && (
        <blockquote className="mt-3 border-l-2 border-indigo-400/70 pl-3 text-sm text-zinc-400">
          {comment.anchorText}
        </blockquote>
      )}
      {comment.attachments.length > 0 && (
        <ul className="mt-3 space-y-2">
          {comment.attachments.map((attachment) => (
            <li key={attachment.id}>
              <a
                href={attachment.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 text-sm text-indigo-300 hover:text-indigo-200"
              >
                <FileIcon className="size-4" />
                <span>{attachment.fileName}</span>
                <span className="text-xs text-zinc-500">
                  {formatFileSize(attachment.size)}
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="mt-3"
        onClick={() => onReply(comment.id)}
      >
        <Reply className="size-3.5" /> Responder
      </Button>
      {replyingTo === comment.id && (
        <div className="mt-3 border-l-2 border-indigo-400/40 pl-4">
          <CommentComposer
            {...composer}
            replyToName={comment.createdBy.name}
            onCancelReply={onCancelReply}
          />
        </div>
      )}
      {replies.length > 0 && (
        <div className="mt-3 space-y-3 border-l border-indigo-400/30 pl-4">
          {replies.map((reply) => (
            <CommentThread
              key={reply.comment.id}
              thread={reply}
              deletingComment={deletingComment}
              onDelete={onDelete}
              onReply={onReply}
              replyingTo={replyingTo}
              onCancelReply={onCancelReply}
              composer={composer}
            />
          ))}
        </div>
      )}
    </article>
  );
}

interface ComposerProps {
  content: string;
  files: File[];
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  isPending: boolean;
  error: string;
  onContentChange: (value: string) => void;
  onFilesChange: (files: File[]) => void;
  onSubmit: (event: React.FormEvent) => void;
}

function CommentComposer({
  content,
  files,
  fileInputRef,
  isPending,
  error,
  anchorText,
  replyToName,
  onContentChange,
  onFilesChange,
  onSubmit,
  onClearAnchor,
  onCancelReply,
}: ComposerProps & {
  anchorText?: string | null;
  replyToName?: string;
  onClearAnchor?: () => void;
  onCancelReply?: () => void;
}) {
  return (
    <form className="space-y-3" onSubmit={onSubmit}>
      {replyToName && (
        <div className="flex items-center justify-between rounded-lg bg-indigo-500/10 px-3 py-2 text-xs text-indigo-200">
          Respondiendo a {replyToName}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onCancelReply}
          >
            Cancelar
          </Button>
        </div>
      )}
      {anchorText && onClearAnchor && (
        <div className="flex items-start justify-between gap-3 rounded-lg border border-indigo-400/25 bg-indigo-500/10 px-3 py-2 text-xs text-indigo-100">
          <span className="line-clamp-3">Comentario sobre: “{anchorText}”</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="shrink-0"
            onClick={onClearAnchor}
          >
            Cancelar
          </Button>
        </div>
      )}
      <Textarea
        value={content}
        maxLength={4000}
        placeholder="Escribe un comentario…"
        onChange={(event) => onContentChange(event.target.value)}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-zinc-300 hover:text-white">
          <Paperclip className="size-4" /> Adjuntar archivos
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={ACCEPTED_FILES}
            className="sr-only"
            onChange={(event) =>
              onFilesChange(Array.from(event.target.files ?? []))
            }
          />
        </label>
        <Button
          type="submit"
          size="sm"
          disabled={isPending || (!content.trim() && files.length === 0)}
        >
          <Send className="size-3.5" /> Publicar
        </Button>
      </div>
      {files.length > 0 && (
        <ul className="space-y-1 text-xs text-zinc-400">
          {files.map((file) => (
            <li key={`${file.name}-${file.lastModified}`}>
              {file.name} · {formatFileSize(file.size)}
            </li>
          ))}
        </ul>
      )}
      {error && <p className="text-sm text-red-300">{error}</p>}
    </form>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('es-CL', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function formatFileSize(size: number) {
  if (size < 1024 * 1024) return `${Math.ceil(size / 1024)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}
