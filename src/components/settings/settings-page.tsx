'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowDown,
  ArrowUp,
  Pencil,
  Plus,
  Trash2,
  UserMinus,
} from 'lucide-react';
import * as api from '@/lib/api/kanbans';
import { kanbanKeys } from '@/hooks/use-kanbans';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { AppRole, Kanban, Team, TeamMembershipRole } from '@/lib/types';

export function SettingsPage({ currentRole }: { currentRole: AppRole }) {
  const client = useQueryClient();
  const users = useQuery({ queryKey: ['app-users'], queryFn: api.fetchUsers });
  const teams = useQuery({ queryKey: ['teams'], queryFn: api.fetchTeams });
  const kanbans = useQuery({
    queryKey: kanbanKeys.all,
    queryFn: api.fetchKanbans,
  });
  const [error, setError] = useState('');
  const mutation = useMutation({
    mutationFn: (operation: () => Promise<unknown>) => operation(),
    onSuccess: async () => {
      setError('');
      await Promise.all([
        client.invalidateQueries({ queryKey: ['app-users'] }),
        client.invalidateQueries({ queryKey: ['teams'] }),
        client.invalidateQueries({ queryKey: kanbanKeys.all }),
      ]);
    },
    onError: (mutationError) =>
      setError(
        mutationError instanceof Error
          ? mutationError.message
          : 'La operación falló',
      ),
  });
  const run = (operation: () => Promise<unknown>) => mutation.mutate(operation);

  if (users.isLoading || teams.isLoading || kanbans.isLoading)
    return (
      <div className="h-72 animate-pulse rounded-xl border border-white/8 bg-white/4" />
    );
  const loadError = users.error ?? teams.error ?? kanbans.error;
  if (loadError)
    return (
      <p className="rounded-xl bg-red-500/10 p-4 text-red-300">
        {loadError.message}
      </p>
    );

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold">Configuración</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Administra equipos, permisos y kanbans.
        </p>
      </header>
      {error && (
        <p className="rounded-xl border border-red-400/20 bg-red-500/10 p-3 text-sm text-red-300">
          {error}
        </p>
      )}
      {currentRole === 'ADMIN' && (
        <UsersSection users={users.data ?? []} run={run} />
      )}
      <TeamsSection
        teams={teams.data ?? []}
        users={users.data ?? []}
        isAdmin={currentRole === 'ADMIN'}
        run={run}
      />
      <KanbansSection
        kanbans={kanbans.data ?? []}
        teams={teams.data ?? []}
        run={run}
      />
    </div>
  );
}

type Runner = (operation: () => Promise<unknown>) => void;

function UsersSection({
  users,
  run,
}: {
  users: Awaited<ReturnType<typeof api.fetchUsers>>;
  run: Runner;
}) {
  return (
    <Section
      title="Usuarios"
      description="Solo administradores pueden cambiar roles globales."
    >
      <div className="divide-y divide-white/8">
        {users.map((user) => (
          <div
            key={user.userId}
            className="flex items-center justify-between gap-3 py-3"
          >
            <div>
              <p className="text-sm font-medium">{user.name}</p>
              <p className="text-xs text-zinc-500">{user.email}</p>
            </div>
            <select
              className="rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm"
              value={user.role}
              onChange={(event) =>
                run(() =>
                  api.updateUserRole(
                    user.userId,
                    event.target.value as AppRole,
                  ),
                )
              }
            >
              <option value="USER">Usuario</option>
              <option value="ADMIN">Administrador</option>
            </select>
          </div>
        ))}
      </div>
    </Section>
  );
}

function TeamsSection({
  teams,
  users,
  isAdmin,
  run,
}: {
  teams: Team[];
  users: Awaited<ReturnType<typeof api.fetchUsers>>;
  isAdmin: boolean;
  run: Runner;
}) {
  const [name, setName] = useState('');
  const [selections, setSelections] = useState<Record<string, string>>({});
  return (
    <Section
      title="Equipos"
      description="Los jefes pueden gestionar personas y configuración de sus equipos."
    >
      {isAdmin && (
        <form
          className="mb-5 flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (!name.trim()) return;
            run(async () => {
              await api.createTeam({ name });
              setName('');
            });
          }}
        >
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Nombre del equipo"
          />
          <Button>
            <Plus className="size-4" />
            Crear
          </Button>
        </form>
      )}
      <div className="grid gap-4 xl:grid-cols-2">
        {teams.map((team) => {
          const available = users.filter(
            (user) =>
              !team.members.some((member) => member.userId === user.userId),
          );
          return (
            <div
              key={team.id}
              className="rounded-xl border border-white/8 bg-black/10 p-4"
            >
              <div className="mb-4 flex items-center justify-between gap-2">
                <h3 className="font-medium">{team.name}</h3>
                {team.canManage && (
                  <div className="flex gap-1">
                    <IconButton
                      label="Renombrar"
                      icon={Pencil}
                      onClick={() =>
                        renameWithPrompt(team.name, (next) =>
                          run(() => api.updateTeam(team.id, next)),
                        )
                      }
                    />
                    <IconButton
                      label="Cancelar equipo"
                      icon={Trash2}
                      danger
                      onClick={() =>
                        confirmRun('¿Cancelar este equipo?', () =>
                          run(() => api.cancelTeam(team.id)),
                        )
                      }
                    />
                  </div>
                )}
              </div>
              <div className="space-y-2">
                {team.members.map((member) => (
                  <div
                    key={member.membershipId}
                    className="flex items-center justify-between gap-2 rounded-lg bg-white/4 p-2"
                  >
                    <div>
                      <p className="text-sm">{member.name}</p>
                      <p className="text-xs text-zinc-600">{member.email}</p>
                    </div>
                    {team.canManage ? (
                      <div className="flex items-center gap-1">
                        <select
                          className="rounded border border-white/10 bg-zinc-950 p-1.5 text-xs"
                          value={member.membershipRole}
                          onChange={(event) =>
                            run(() =>
                              api.updateTeamMember(
                                team.id,
                                member.membershipId,
                                event.target.value as TeamMembershipRole,
                              ),
                            )
                          }
                        >
                          <option value="MEMBER">Miembro</option>
                          <option value="LEADER">Jefe</option>
                        </select>
                        <IconButton
                          label="Quitar del equipo"
                          icon={UserMinus}
                          danger
                          onClick={() =>
                            confirmRun('¿Quitar esta persona del equipo?', () =>
                              run(() =>
                                api.cancelTeamMember(
                                  team.id,
                                  member.membershipId,
                                ),
                              ),
                            )
                          }
                        />
                      </div>
                    ) : (
                      <span className="text-xs text-zinc-500">
                        {member.membershipRole === 'LEADER'
                          ? 'Jefe'
                          : 'Miembro'}
                      </span>
                    )}
                  </div>
                ))}
              </div>
              {team.canManage && available.length > 0 && (
                <form
                  className="mt-3 flex gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const userId = selections[team.id] ?? available[0]?.userId;
                    if (userId)
                      run(() => api.addTeamMember(team.id, userId, 'MEMBER'));
                  }}
                >
                  <select
                    className="min-w-0 flex-1 rounded-lg border border-white/10 bg-zinc-950 px-2 text-sm"
                    value={selections[team.id] ?? available[0]?.userId}
                    onChange={(event) =>
                      setSelections({
                        ...selections,
                        [team.id]: event.target.value,
                      })
                    }
                  >
                    {available.map((user) => (
                      <option key={user.userId} value={user.userId}>
                        {user.name}
                      </option>
                    ))}
                  </select>
                  <Button size="sm">Agregar</Button>
                </form>
              )}
            </div>
          );
        })}
      </div>
    </Section>
  );
}

function KanbansSection({
  kanbans,
  teams,
  run,
}: {
  kanbans: Kanban[];
  teams: Team[];
  run: Runner;
}) {
  const manageableTeams = teams.filter((team) => team.canManage);
  const [name, setName] = useState('');
  const [teamIds, setTeamIds] = useState<string[]>([]);
  return (
    <Section
      title="Kanbans"
      description="Cada kanban define sus equipos, estados y etiquetas."
    >
      {manageableTeams.length > 0 && (
        <form
          className="mb-6 space-y-3 rounded-xl border border-white/8 p-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!name.trim() || !teamIds.length) return;
            run(async () => {
              await api.createKanban({ name, teamIds });
              setName('');
              setTeamIds([]);
            });
          }}
        >
          <div className="flex gap-2">
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Nombre del kanban"
            />
            <Button>
              <Plus className="size-4" />
              Crear kanban
            </Button>
          </div>
          <TeamChecks
            teams={manageableTeams}
            selected={teamIds}
            onChange={setTeamIds}
          />
        </form>
      )}
      <div className="space-y-4">
        {kanbans
          .filter((kanban) => kanban.canManage)
          .map((kanban) => (
            <KanbanSettings
              key={`${kanban.id}:${kanban.teams.map((team) => team.id).join(',')}`}
              kanban={kanban}
              teams={teams}
              run={run}
            />
          ))}
      </div>
    </Section>
  );
}

function KanbanSettings({
  kanban,
  teams,
  run,
}: {
  kanban: Kanban;
  teams: Team[];
  run: Runner;
}) {
  const [selectedTeamIds, setSelectedTeamIds] = useState(
    kanban.teams.map((team) => team.id),
  );
  const teamOptions = [
    ...kanban.teams.map((team) => ({
      ...team,
      canManage:
        teams.find((candidate) => candidate.id === team.id)?.canManage ?? false,
    })),
    ...teams.filter(
      (team) => !kanban.teams.some((assigned) => assigned.id === team.id),
    ),
  ];
  return (
    <details className="rounded-xl border border-white/8 bg-black/10 p-4">
      <summary className="cursor-pointer font-medium">{kanban.name}</summary>
      <div className="mt-5 space-y-6">
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              renameWithPrompt(kanban.name, (name) =>
                run(() => api.updateKanban(kanban.id, { name })),
              )
            }
          >
            <Pencil className="size-4" />
            Renombrar
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={() =>
              confirmRun(
                '¿Cancelar este kanban? Solo es posible si no contiene tarjetas activas.',
                () => run(() => api.cancelKanban(kanban.id)),
              )
            }
          >
            <Trash2 className="size-4" />
            Cancelar
          </Button>
        </div>
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Equipos asignados</h4>
          <TeamChecks
            teams={teamOptions}
            selected={selectedTeamIds}
            onChange={setSelectedTeamIds}
          />
          <Button
            size="sm"
            onClick={() =>
              run(() =>
                api.updateKanban(kanban.id, { teamIds: selectedTeamIds }),
              )
            }
          >
            Guardar equipos
          </Button>
        </div>
        <ManageNames
          title="Estados"
          values={kanban.states}
          onCreate={(name) => run(() => api.createState(kanban.id, name))}
          onRename={(id, name) =>
            run(() => api.updateState(kanban.id, id, name))
          }
          onDelete={(id) => run(() => api.cancelState(kanban.id, id))}
          onMove={(index, direction) => {
            const next = [...kanban.states];
            const target = index + direction;
            if (target < 0 || target >= next.length) return;
            [next[index], next[target]] = [next[target], next[index]];
            run(() =>
              api.reorderStates(
                kanban.id,
                next.map((state) => state.id),
              ),
            );
          }}
        />
        <ManageNames
          title="Etiquetas"
          values={kanban.tags}
          onCreate={(name) => run(() => api.createTag(kanban.id, name))}
          onRename={(id, name) => run(() => api.updateTag(kanban.id, id, name))}
          onDelete={(id) => run(() => api.cancelTag(kanban.id, id))}
        />
      </div>
    </details>
  );
}

function ManageNames({
  title,
  values,
  onCreate,
  onRename,
  onDelete,
  onMove,
}: {
  title: string;
  values: Array<{ id: string; name: string }>;
  onCreate: (name: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onMove?: (index: number, direction: -1 | 1) => void;
}) {
  const [name, setName] = useState('');
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium">{title}</h4>
      {values.map((value, index) => (
        <div
          key={value.id}
          className="flex items-center justify-between rounded-lg bg-white/4 px-3 py-2 text-sm"
        >
          <span>{value.name}</span>
          <div className="flex gap-1">
            {onMove && (
              <>
                <IconButton
                  label="Subir"
                  icon={ArrowUp}
                  disabled={index === 0}
                  onClick={() => onMove(index, -1)}
                />
                <IconButton
                  label="Bajar"
                  icon={ArrowDown}
                  disabled={index === values.length - 1}
                  onClick={() => onMove(index, 1)}
                />
              </>
            )}
            <IconButton
              label="Renombrar"
              icon={Pencil}
              onClick={() =>
                renameWithPrompt(value.name, (next) => onRename(value.id, next))
              }
            />
            <IconButton
              label="Cancelar"
              icon={Trash2}
              danger
              onClick={() =>
                confirmRun(`¿Cancelar ${value.name}?`, () => onDelete(value.id))
              }
            />
          </div>
        </div>
      ))}
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (name.trim()) {
            onCreate(name);
            setName('');
          }
        }}
      >
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={`Nueva ${title.toLowerCase().replace(/s$/, '')}`}
        />
        <Button size="sm">Agregar</Button>
      </form>
    </div>
  );
}

function TeamChecks({
  teams,
  selected,
  onChange,
}: {
  teams: Array<Pick<Team, 'id' | 'name'> & Partial<Pick<Team, 'canManage'>>>;
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {teams.map((team) => (
        <label
          key={team.id}
          className="flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm"
        >
          <input
            type="checkbox"
            checked={selected.includes(team.id)}
            disabled={team.canManage === false}
            onChange={(event) =>
              onChange(
                event.target.checked
                  ? [...selected, team.id]
                  : selected.filter((id) => id !== team.id),
              )
            }
          />
          {team.name}
        </label>
      ))}
    </div>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-white/8 bg-zinc-950/50 p-5">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mb-5 text-sm text-zinc-500">{description}</p>
      {children}
    </section>
  );
}

function IconButton({
  label,
  icon: Icon,
  danger,
  disabled,
  onClick,
}: {
  label: string;
  icon: typeof Pencil;
  danger?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={danger ? 'text-red-300' : ''}
      disabled={disabled}
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      <Icon className="size-4" />
    </Button>
  );
}

function renameWithPrompt(current: string, action: (name: string) => void) {
  const name = window.prompt('Nuevo nombre', current)?.trim();
  if (name && name !== current) action(name);
}

function confirmRun(message: string, action: () => void) {
  if (window.confirm(message)) action();
}
