import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { MarkdownEditor } from '@/components/ui/markdown-editor';

function Harness() {
  const [value, setValue] = useState('texto');
  return <MarkdownEditor value={value} onChange={setValue} />;
}

describe('MarkdownEditor', () => {
  it('inserta formato markdown y permite previsualizarlo', async () => {
    render(<Harness />);
    const textarea = screen.getByRole('textbox');
    textarea.focus();
    (textarea as HTMLTextAreaElement).setSelectionRange(0, 5);
    await userEvent.click(screen.getByRole('button', { name: 'Negrita' }));
    expect(textarea).toHaveValue('**texto**');
    await userEvent.click(screen.getByRole('button', { name: 'Vista previa' }));
    expect(screen.getByText('texto').tagName).toBe('STRONG');
  });
});
