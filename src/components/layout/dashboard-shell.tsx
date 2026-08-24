'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Columns3, LogOut, Table2, TicketCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function DashboardShell({
  children,
  userName,
}: {
  children: React.ReactNode;
  userName: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [sync, setSync] = useState('Conectando');
  useEffect(() => {
    const listener = (event: Event) =>
      setSync((event as CustomEvent<string>).detail);
    window.addEventListener('ticket-sync-status', listener);
    return () => window.removeEventListener('ticket-sync-status', listener);
  }, []);

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.replace('/login');
    router.refresh();
  }

  const links = [
    { href: '/kanban', label: 'Kanban', icon: Columns3 },
    { href: '/table', label: 'Tabla', icon: Table2 },
  ];
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[240px_1fr]">
      <aside className="border-b border-white/8 bg-zinc-950/80 p-4 backdrop-blur lg:min-h-screen lg:border-b-0 lg:border-r">
        <div className="flex items-center gap-3 px-2 py-3">
          <div className="grid size-9 place-items-center rounded-xl bg-blue-600">
            <TicketCheck className="size-5" />
          </div>
          <div>
            <p className="font-semibold">Ticketera Rial</p>
            <p className="text-xs text-zinc-600">Soporte interno</p>
          </div>
        </div>
        <nav className="mt-4 flex gap-2 lg:block lg:space-y-1">
          {links.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-zinc-400 transition hover:bg-white/6 hover:text-white',
                pathname === href && 'bg-blue-500/12 text-blue-300',
              )}
            >
              <Icon className="size-4" />
              {label}
            </Link>
          ))}
        </nav>
      </aside>
      <div>
        <header className="flex h-16 items-center justify-between border-b border-white/8 bg-zinc-950/55 px-5 backdrop-blur">
          <div>
            <p className="text-sm font-medium">{userName}</p>
            <p className="flex items-center gap-1.5 text-xs text-zinc-500">
              <span
                className={cn(
                  'size-1.5 rounded-full',
                  sync === 'Conectado' ? 'bg-emerald-400' : 'bg-amber-400',
                )}
              />
              Realtime: {sync}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={logout}>
            <LogOut className="size-4" />
            Salir
          </Button>
        </header>
        <main className="p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
