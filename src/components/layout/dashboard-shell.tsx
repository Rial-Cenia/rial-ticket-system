'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  Columns3,
  ListTodo,
  LogOut,
  Settings,
  Table2,
  TicketCheck,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function DashboardShell({
  children,
  userName,
  userRole,
  canConfigure,
}: {
  children: React.ReactNode;
  userName: string;
  userRole: 'ADMIN' | 'USER';
  canConfigure: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const showsTicketSync = pathname.startsWith('/tickets');
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

  const groups = [
    {
      label: 'Tickets',
      icon: TicketCheck,
      links: [
        { href: '/tickets/kanban', label: 'Kanban', icon: Columns3 },
        { href: '/tickets/table', label: 'Tabla', icon: Table2 },
      ],
    },
    {
      label: 'Tareas',
      icon: ListTodo,
      links: [
        { href: '/tasks/kanban', label: 'Kanban', icon: Columns3 },
        { href: '/tasks/table', label: 'Tabla', icon: Table2 },
      ],
    },
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
        <nav className="mt-4 flex gap-3 overflow-x-auto lg:block lg:space-y-4">
          {groups.map(({ label, icon: GroupIcon, links }) => (
            <div key={label} className="shrink-0">
              <p className="mb-1 flex items-center gap-2 px-3 text-xs font-medium uppercase tracking-wider text-zinc-600">
                <GroupIcon className="size-3.5" />
                {label}
              </p>
              <div className="flex gap-1 lg:block lg:space-y-1">
                {links.map(({ href, label: linkLabel, icon: Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-zinc-400 transition hover:bg-white/6 hover:text-white',
                      pathname === href && 'bg-blue-500/12 text-blue-300',
                    )}
                  >
                    <Icon className="size-4" />
                    {linkLabel}
                  </Link>
                ))}
              </div>
            </div>
          ))}
          <div className="shrink-0 lg:space-y-1">
            <Link
              href="/discord"
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-zinc-400 hover:bg-white/6 hover:text-white',
                pathname === '/discord' && 'bg-blue-500/12 text-blue-300',
              )}
            >
              <Users className="size-4" />
              Discord
            </Link>
            {canConfigure && (
              <Link
                href="/settings"
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-zinc-400 hover:bg-white/6 hover:text-white',
                  pathname === '/settings' && 'bg-blue-500/12 text-blue-300',
                )}
              >
                <Settings className="size-4" />
                Configuración
              </Link>
            )}
          </div>
        </nav>
      </aside>
      <div className="min-w-0">
        <header className="flex h-16 items-center justify-between border-b border-white/8 bg-zinc-950/55 px-5 backdrop-blur">
          <div>
            <p className="text-sm font-medium">{userName}</p>
            <p className="text-[11px] text-zinc-600">
              {userRole === 'ADMIN' ? 'Administrador' : 'Usuario'}
            </p>
            {showsTicketSync && (
              <p className="flex items-center gap-1.5 text-xs text-zinc-500">
                <span
                  className={cn(
                    'size-1.5 rounded-full',
                    sync === 'Conectado' ? 'bg-emerald-400' : 'bg-amber-400',
                  )}
                />
                Realtime: {sync}
              </p>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={logout}>
            <LogOut className="size-4" />
            Salir
          </Button>
        </header>
        <main className="min-w-0 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
