'use client';

import { useRef, useState } from 'react';
import { Bold, Code2, Italic, Link, List } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface Props {
  value: string;
  onChange: (value: string) => void;
  id?: string;
}

const actions = [
  {
    label: 'Negrita',
    icon: Bold,
    before: '**',
    after: '**',
    placeholder: 'texto',
  },
  {
    label: 'Cursiva',
    icon: Italic,
    before: '_',
    after: '_',
    placeholder: 'texto',
  },
  {
    label: 'Código',
    icon: Code2,
    before: '`',
    after: '`',
    placeholder: 'código',
  },
  {
    label: 'Lista',
    icon: List,
    before: '- ',
    after: '',
    placeholder: 'elemento',
  },
  {
    label: 'Enlace',
    icon: Link,
    before: '[',
    after: '](https://)',
    placeholder: 'texto',
  },
] as const;

export function MarkdownEditor({ value, onChange, id }: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [preview, setPreview] = useState(false);

  function applyFormat(before: string, after: string, placeholder: string) {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = value.slice(start, end) || placeholder;
    const next = `${value.slice(0, start)}${before}${selected}${after}${value.slice(end)}`;
    onChange(next);
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(
        start + before.length,
        start + before.length + selected.length,
      );
    });
  }

  return (
    <div className="overflow-hidden rounded-lg border border-white/10 bg-zinc-950">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 p-2">
        <div className="flex gap-1">
          {actions.map(({ label, icon: Icon, before, after, placeholder }) => (
            <Button
              key={label}
              type="button"
              variant="ghost"
              size="icon"
              className="size-8"
              aria-label={label}
              onClick={() => applyFormat(before, after, placeholder)}
            >
              <Icon className="size-4" />
            </Button>
          ))}
        </div>
        <div className="flex rounded-md bg-white/5 p-0.5 text-xs">
          {['Editar', 'Vista previa'].map((label, index) => (
            <button
              key={label}
              type="button"
              className={cn(
                'rounded px-2 py-1 text-zinc-400',
                preview === Boolean(index) && 'bg-white/10 text-white',
              )}
              onClick={() => setPreview(Boolean(index))}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {preview ? (
        <div className="prose prose-invert min-h-40 max-w-none overflow-auto p-3 text-sm text-zinc-200">
          {value ? (
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{value}</ReactMarkdown>
          ) : (
            <span className="text-zinc-600">Nada que previsualizar.</span>
          )}
        </div>
      ) : (
        <Textarea
          ref={textareaRef}
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="min-h-40 rounded-none border-0 focus:border-0"
        />
      )}
    </div>
  );
}

export function MarkdownContent({ children }: { children: string }) {
  return (
    <div className="prose prose-invert max-w-none text-sm text-zinc-300">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  );
}
