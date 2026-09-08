'use client';

import { useRef, useState } from 'react';
import { Bold, Code2, Italic, Link, List } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';
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

const markdownComponents: Components = {
  h1: ({ children }) => (
    <h1 className="text-2xl font-semibold tracking-tight text-white">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-xl font-semibold tracking-tight text-white">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-lg font-semibold text-white">{children}</h3>
  ),
  p: ({ children }) => <p className="leading-6">{children}</p>,
  ul: ({ children }) => (
    <ul className="list-disc space-y-1 pl-6">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal space-y-1 pl-6">{children}</ol>
  ),
  li: ({ children }) => <li className="pl-1">{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-indigo-400/70 pl-4 italic text-zinc-400">
      {children}
    </blockquote>
  ),
  a: ({ children, href }) => (
    <a
      className="text-indigo-300 underline decoration-indigo-400/50 underline-offset-2 hover:text-indigo-200"
      href={href}
      target="_blank"
      rel="noreferrer"
    >
      {children}
    </a>
  ),
  code: ({ children, className }) => (
    <code
      className={cn(
        'rounded bg-white/10 px-1.5 py-0.5 font-mono text-[0.9em] text-indigo-200',
        className,
      )}
    >
      {children}
    </code>
  ),
  pre: ({ children }) => (
    <pre className="overflow-x-auto rounded-lg bg-black/40 p-3 text-sm text-zinc-200">
      {children}
    </pre>
  ),
  hr: () => <hr className="border-white/10" />,
};

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
        <div className="min-h-72 max-w-none space-y-3 overflow-auto p-4 text-sm text-zinc-200">
          {value ? (
            <ReactMarkdown
              components={markdownComponents}
              remarkPlugins={[remarkGfm]}
            >
              {value}
            </ReactMarkdown>
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
          className="min-h-72 resize-y rounded-none border-0 focus:border-0"
        />
      )}
    </div>
  );
}

export function MarkdownContent({ children }: { children: string }) {
  return (
    <div className="space-y-3 text-sm text-zinc-300">
      <ReactMarkdown
        components={markdownComponents}
        remarkPlugins={[remarkGfm]}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
