'use client';

import { Moon, Sun } from 'lucide-react';
import { useEffect, useSyncExternalStore } from 'react';
import { Button } from '@/components/ui/button';

const THEME_STORAGE_KEY = 'rial-ticket-theme';

type Theme = 'dark' | 'light';

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle('light', theme === 'light');
  document.documentElement.style.colorScheme = theme;
}

function subscribeToTheme(callback: () => void) {
  window.addEventListener('rial-theme-change', callback);
  return () => window.removeEventListener('rial-theme-change', callback);
}

function getThemeSnapshot(): Theme {
  if (document.documentElement.classList.contains('light')) return 'light';
  return window.localStorage.getItem(THEME_STORAGE_KEY) === 'light'
    ? 'light'
    : 'dark';
}

function getServerThemeSnapshot(): Theme {
  return 'dark';
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(
    subscribeToTheme,
    getThemeSnapshot,
    getServerThemeSnapshot,
  );

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  function toggleTheme() {
    const nextTheme: Theme = theme === 'dark' ? 'light' : 'dark';
    window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    applyTheme(nextTheme);
    window.dispatchEvent(new Event('rial-theme-change'));
  }

  const isLight = theme === 'light';

  return (
    <Button
      aria-label={isLight ? 'Activar modo oscuro' : 'Activar modo claro'}
      title={isLight ? 'Activar modo oscuro' : 'Activar modo claro'}
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
    >
      {isLight ? <Moon className="size-4" /> : <Sun className="size-4" />}
    </Button>
  );
}
