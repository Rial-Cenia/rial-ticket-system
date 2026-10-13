'use client';

import { FileIcon, Paperclip, Send, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { MarkdownContent } from '@/components/ui/markdown-editor';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import {
  useCreateKanbanCardComment,
  useDeleteKanbanCardComment,
  useKanbanCardComments,
} from '@/hooks/use-kanbans';
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
}

export function KanbanCardComments({ kanbanId, cardId }: Props) {
  const comments = useKanbanCardComments(kanbanId, cardId);
  const create = useCreateKanbanCardComment(kanbanId, cardId);
  const remove = useDeleteKanbanCardComment(kanbanId, cardId);
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [content, setContent] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState('');

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    const formData = new FormData();
    formData.set('content', content);
    files.forEach((file) => formData.append('attachments', file));
    try {
      await create.mutateAsync(formData);
      setContent('');
      setFiles([]);
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
    <section className="space-y-4 border-t border-white/8 pt-6">
      <div>
        <h3 className="text-sm font-medium">Comentarios</h3>
        <p className="mt-1 text-xs text-zinc-500">
          Usa Markdown para compartir links y contexto.
        </p>
      </div>
      <form className="space-y-3" onSubmit={submit}>
        <Textarea
          value={content}
          maxLength={4000}
          placeholder="Escribe un comentario…"
          onChange={(event) => setContent(event.target.value)}
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
                setFiles(Array.from(event.target.files ?? []))
              }
            />
          </label>
          <Button
            type="submit"
            size="sm"
            disabled={
              create.isPending || (!content.trim() && files.length === 0)
            }
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
        {comments.data?.map((comment) => (
          <article
            key={comment.id}
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
                  disabled={remove.isPending}
                  onClick={() => deleteComment(comment.id)}
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
          </article>
        ))}
      </div>
    </section>
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
