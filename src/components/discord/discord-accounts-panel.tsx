'use client';

import { Link2, Search, ShieldCheck, Unlink, Users } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { DiscordLinkedUser } from '@/lib/types';

interface Props {
  currentUserId: string;
  initialStatus: { linked?: string; error?: string };
  initialUsers: DiscordLinkedUser[];
}

function errorMessage(value?: string) {
  if (!value) return null;
  const known: Record<string, string> = {
    auth: 'Tu sesión expiró. Inicia sesión nuevamente.',
    cancelled: 'Cancelaste la conexión con Discord.',
    invalid_state:
      'La autorización expiró o no pudo validarse. Inténtalo de nuevo.',
  };
  return known[value] ?? value;
}

export function DiscordAccountsPanel({
  currentUserId,
  initialStatus,
  initialUsers,
}: Props) {
  const [users, setUsers] = useState<DiscordLinkedUser[]>(initialUsers);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [changingUserId, setChangingUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(
    errorMessage(initialStatus.error),
  );

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/discord/accounts', {
        cache: 'no-store',
      });
      const body = (await response.json()) as {
        data?: DiscordLinkedUser[];
        error?: string;
      };
      if (!response.ok)
        throw new Error(body.error ?? 'No fue posible cargar los usuarios');
      setUsers(body.data ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Error inesperado');
    } finally {
      setLoading(false);
    }
  }, []);

  const currentUser = users.find((user) => user.userId === currentUserId);
  const visibleUsers = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) return users;
    return users.filter((user) =>
      [
        user.name,
        user.email,
        user.link?.discordUsername,
        user.link?.discordDisplayName,
        user.link?.guildNickname,
      ].some((value) => value?.toLocaleLowerCase().includes(query)),
    );
  }, [search, users]);

  async function updateRole(user: DiscordLinkedUser, enabled: boolean) {
    setChangingUserId(user.userId);
    setError(null);
    try {
      const response = await fetch(
        `/api/discord/accounts/${user.userId}/role`,
        {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ enabled }),
        },
      );
      const body = (await response.json()) as { error?: string };
      if (!response.ok)
        throw new Error(body.error ?? 'No fue posible cambiar el rol');
      await loadUsers();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Error inesperado');
    } finally {
      setChangingUserId(null);
    }
  }

  async function unlinkCurrentUser() {
    setChangingUserId(currentUserId);
    setError(null);
    try {
      const response = await fetch('/api/discord/accounts/me', {
        method: 'DELETE',
      });
      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        throw new Error(body.error ?? 'No fue posible desvincular la cuenta');
      }
      await loadUsers();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Error inesperado');
    } finally {
      setChangingUserId(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Cuentas y roles de Discord
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Vincula cada cuenta de la ticketera y administra el rol Barbilla
            roja.
          </p>
        </div>
        {currentUser?.link ? (
          <Button
            variant="outline"
            onClick={unlinkCurrentUser}
            disabled={changingUserId === currentUserId}
          >
            <Unlink className="size-4" />
            Desvincular mi Discord
          </Button>
        ) : (
          <Button asChild>
            <a href="/api/discord/oauth">
              <Link2 className="size-4" />
              Vincular mi Discord
            </a>
          </Button>
        )}
      </div>

      {initialStatus.linked === 'true' && (
        <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/10 p-4 text-sm text-emerald-300">
          Tu cuenta de Discord quedó vinculada correctamente.
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="rounded-2xl border border-white/8 bg-zinc-950/45">
        <div className="flex flex-col gap-3 border-b border-white/8 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm text-zinc-300">
            <Users className="size-4" />
            {users.length} cuentas de la ticketera
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-600" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar usuario o Discord"
              className="pl-9"
            />
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-zinc-500">
            Cargando miembros…
          </div>
        ) : visibleUsers.length === 0 ? (
          <div className="p-8 text-center text-sm text-zinc-500">
            No se encontraron usuarios.
          </div>
        ) : (
          <div className="divide-y divide-white/8">
            {visibleUsers.map((user) => (
              <div
                key={user.userId}
                className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-medium">{user.name}</p>
                    {user.userId === currentUserId && <Badge>Tú</Badge>}
                    {user.hasTriagerRole && (
                      <Badge className="border-red-400/20 bg-red-500/10 text-red-300">
                        <ShieldCheck className="mr-1 size-3" />
                        Barbilla roja
                      </Badge>
                    )}
                  </div>
                  <p className="truncate text-sm text-zinc-500">{user.email}</p>
                  {user.link ? (
                    <p className="mt-1 text-sm text-indigo-300">
                      Discord:{' '}
                      {user.link.discordDisplayName ??
                        user.link.discordUsername}
                      <span className="text-zinc-600">
                        {' '}
                        · @{user.link.discordUsername}
                      </span>
                      {!user.isGuildMember && (
                        <span className="ml-2 text-amber-300">
                          Fuera del servidor
                        </span>
                      )}
                    </p>
                  ) : (
                    <p className="mt-1 text-sm text-zinc-600">
                      Discord sin vincular
                    </p>
                  )}
                </div>

                {user.link && user.isGuildMember && (
                  <Button
                    variant={user.hasTriagerRole ? 'danger' : 'secondary'}
                    size="sm"
                    disabled={changingUserId === user.userId}
                    onClick={() => updateRole(user, !user.hasTriagerRole)}
                  >
                    {user.hasTriagerRole
                      ? 'Quitar rol'
                      : 'Asignar Barbilla roja'}
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
