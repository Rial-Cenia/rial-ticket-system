import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ThemeToggle } from '@/components/ui/theme-toggle';

const storage = new Map<string, string>();
const localStorageMock: Storage = {
  get length() {
    return storage.size;
  },
  clear: () => storage.clear(),
  getItem: (key) => storage.get(key) ?? null,
  key: (index) => Array.from(storage.keys())[index] ?? null,
  removeItem: (key) => storage.delete(key),
  setItem: (key, value) => storage.set(key, value),
};

describe('ThemeToggle', () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: localStorageMock,
    });
    localStorageMock.clear();
    document.documentElement.classList.remove('light');
    document.documentElement.style.colorScheme = '';
  });

  it('cambia y persiste la preferencia de modo claro', async () => {
    render(<ThemeToggle />);

    await userEvent.click(
      screen.getByRole('button', { name: 'Activar modo claro' }),
    );

    expect(document.documentElement).toHaveClass('light');
    expect(document.documentElement.style.colorScheme).toBe('light');
    expect(window.localStorage.getItem('rial-ticket-theme')).toBe('light');
    expect(
      screen.getByRole('button', { name: 'Activar modo oscuro' }),
    ).toBeInTheDocument();
  });

  it('recupera una preferencia clara existente', async () => {
    window.localStorage.setItem('rial-ticket-theme', 'light');
    render(<ThemeToggle />);

    expect(
      await screen.findByRole('button', { name: 'Activar modo oscuro' }),
    ).toBeInTheDocument();
    expect(document.documentElement).toHaveClass('light');
  });
});
