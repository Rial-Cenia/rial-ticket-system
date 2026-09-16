'use client';

import { useMemo, useState } from 'react';
import { Clock3, Copy, Flame, UserRoundX } from 'lucide-react';
import { useTicketMetrics } from '@/hooks/use-ticket-metrics';
import { METRICS_DEFAULTS } from '@/lib/metrics/constants';
import {
  PLATFORM_LABELS,
  PLATFORMS,
  PRIORITY_LABELS,
  STATUS_LABELS,
  TYPE_LABELS,
  type Platform,
  type TicketPriority,
} from '@/lib/types';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const priorityOrder: TicketPriority[] = ['CRITICA', 'ALTA', 'MEDIA', 'BAJA'];

function minutesLabel(minutes: number) {
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const hours = minutes / 60;
  if (hours < 24) return `${hours.toFixed(1)} h`;
  return `${(hours / 24).toFixed(1)} días`;
}

function Card({
  title,
  value,
  icon: Icon,
}: {
  title: string;
  value: number;
  icon: typeof Flame;
}) {
  return (
    <div className="rounded-2xl border border-white/8 bg-zinc-900/70 p-5">
      <div className="flex items-center justify-between text-sm text-zinc-500">
        {title}
        <Icon className="size-4 text-blue-300" />
      </div>
      <p className="mt-3 text-3xl font-semibold text-zinc-100">{value}</p>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-white/8 bg-zinc-900/60 p-5">
      <h2 className="mb-4 text-base font-semibold text-zinc-100">{title}</h2>
      {children}
    </section>
  );
}

function HorizontalBars({
  values,
  label,
}: {
  values: Array<{ label: string; value: number }>;
  label: string;
}) {
  const max = Math.max(...values.map((item) => item.value), 1);
  return (
    <div className="space-y-3">
      {values.length === 0 && (
        <p className="text-sm text-zinc-600">Sin datos para este período.</p>
      )}
      {values.map((item) => (
        <div key={`${label}-${item.label}`}>
          <div className="mb-1 flex justify-between text-xs text-zinc-400">
            <span>{item.label}</span>
            <span>{item.value}</span>
          </div>
          <div className="h-2 rounded-full bg-white/6">
            <div
              className="h-2 rounded-full bg-blue-500"
              style={{ width: `${(item.value / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export function TicketMetricsView() {
  const [rangeDays, setRangeDays] = useState<number>(
    METRICS_DEFAULTS.rangeDays,
  );
  const [platform, setPlatform] = useState<Platform | undefined>();
  const [staleDays, setStaleDays] = useState<number>(
    METRICS_DEFAULTS.staleDays,
  );
  const [unassignedHours, setUnassignedHours] = useState<number>(
    METRICS_DEFAULTS.unassignedHours,
  );
  const [sortMttrDesc, setSortMttrDesc] = useState(true);
  const metrics = useTicketMetrics({
    rangeDays,
    platform,
    staleDays,
    unassignedHours,
  });
  const platformLabel = (value: string) =>
    value === 'UNASSIGNED'
      ? 'Sin plataforma'
      : PLATFORM_LABELS[value as Platform];
  const typeValues = useMemo(
    () =>
      (metrics.data?.volume.typeDistribution ?? []).map(({ type, count }) => ({
        label: TYPE_LABELS[type],
        value: count,
      })),
    [metrics.data],
  );
  const platformValues = useMemo(
    () =>
      (metrics.data?.volume.createdByPlatform ?? []).map(
        ({ platform: value, count }) => ({
          label: platformLabel(value),
          value: count,
        }),
      ),
    [metrics.data],
  );
  const sortedMttr = useMemo(() => {
    const values = metrics.data?.quality.mttrByPlatform ?? [];
    return [...values].sort((first, second) =>
      sortMttrDesc
        ? second.mttrMinutes - first.mttrMinutes
        : first.mttrMinutes - second.mttrMinutes,
    );
  }, [metrics.data, sortMttrDesc]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-1 text-xs uppercase tracking-wider text-zinc-500">
            Tickets · Métricas
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">
            Resumen operativo
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Volumen, tiempos y ownership calculados sobre el historial de
            tickets.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select
            value={String(rangeDays)}
            onValueChange={(value) => setRangeDays(Number(value))}
          >
            <SelectTrigger aria-label="Rango de métricas">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Últimos 7 días</SelectItem>
              <SelectItem value="30">Últimos 30 días</SelectItem>
              <SelectItem value="90">Últimos 90 días</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={platform ?? 'ALL'}
            onValueChange={(value) =>
              setPlatform(value === 'ALL' ? undefined : (value as Platform))
            }
          >
            <SelectTrigger aria-label="Plataforma">
              <SelectValue placeholder="Plataforma" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todas las plataformas</SelectItem>
              {PLATFORMS.map((item) => (
                <SelectItem key={item} value={item}>
                  {PLATFORM_LABELS[item]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-white/8 bg-zinc-900/60 p-3 text-sm text-zinc-400">
        <span>Configuración:</span>
        <label className="flex items-center gap-2">
          Estancado &gt;{' '}
          <input
            className="w-16 rounded border border-white/10 bg-zinc-950 px-2 py-1"
            type="number"
            min="1"
            max="30"
            value={staleDays}
            onChange={(event) => setStaleDays(Number(event.target.value) || 1)}
          />{' '}
          días
        </label>
        <label className="flex items-center gap-2">
          Sin encargado &gt;{' '}
          <input
            className="w-16 rounded border border-white/10 bg-zinc-950 px-2 py-1"
            type="number"
            min="1"
            max="168"
            value={unassignedHours}
            onChange={(event) =>
              setUnassignedHours(Number(event.target.value) || 1)
            }
          />{' '}
          h
        </label>
      </div>
      {metrics.isLoading && (
        <div className="h-96 animate-pulse rounded-2xl border border-white/8 bg-white/4" />
      )}
      {metrics.error && (
        <div className="rounded-xl border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-300">
          {metrics.error.message}
        </div>
      )}
      {metrics.data && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Card
              title="Abiertos urgentes hoy"
              value={metrics.data.summary.openHighToday}
              icon={Flame}
            />
            <Card
              title="Sin encargado"
              value={metrics.data.summary.unassigned}
              icon={UserRoundX}
            />
            <Card
              title="Tickets estancados"
              value={metrics.data.summary.stagnant}
              icon={Clock3}
            />
          </div>
          <div className="grid gap-5 xl:grid-cols-2">
            <Section title="Tickets creados por plataforma">
              <HorizontalBars values={platformValues} label="platform" />
            </Section>
            <Section title="Distribución por tipo">
              <HorizontalBars values={typeValues} label="type" />
            </Section>
          </div>
          <div className="grid gap-5 xl:grid-cols-2">
            <Section title="Urgencia por plataforma">
              <div className="space-y-3">
                {metrics.data.volume.urgencyByPlatform.map((item) => (
                  <div
                    key={`${item.platform}-${item.priority}`}
                    className="flex items-center justify-between border-b border-white/6 pb-2 text-sm"
                  >
                    <span>
                      {platformLabel(item.platform)} ·{' '}
                      {PRIORITY_LABELS[item.priority]}
                    </span>
                    <span className="font-medium text-zinc-100">
                      {item.count}
                    </span>
                  </div>
                ))}
              </div>
            </Section>
            <Section title="Tendencia semanal">
              <div className="space-y-3">
                {metrics.data.volume.weeklyTrend.map((item) => (
                  <div
                    key={item.week}
                    className="grid grid-cols-[6rem_1fr_1fr] items-center gap-3 text-xs"
                  >
                    <span className="text-zinc-500">{item.week}</span>
                    <span className="rounded bg-blue-500/60 px-2 py-1 text-center">
                      Creados {item.created}
                    </span>
                    <span className="rounded bg-emerald-500/60 px-2 py-1 text-center">
                      Resueltos {item.resolved}
                    </span>
                  </div>
                ))}
              </div>
            </Section>
          </div>
          <Section title="Tiempos de respuesta">
            <div className="grid gap-5 lg:grid-cols-3">
              <div>
                <p className="text-sm text-zinc-500">TTA promedio</p>
                <p className="mt-2 text-2xl font-semibold">
                  {minutesLabel(metrics.data.response.ttaMinutes)}
                </p>
              </div>
              <div>
                <p className="mb-2 text-sm text-zinc-500">MTTR por urgencia</p>
                <div className="space-y-2 text-sm">
                  {metrics.data.response.ttrByPriority.map((item) => (
                    <div key={item.priority} className="flex justify-between">
                      <span>{PRIORITY_LABELS[item.priority]}</span>
                      <span>{minutesLabel(item.mttrMinutes)}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-2 text-sm text-zinc-500">
                  MTTR por plataforma
                </p>
                <div className="space-y-2 text-sm">
                  {metrics.data.response.ttrByPlatform.map((item) => (
                    <div key={item.platform} className="flex justify-between">
                      <span>{platformLabel(item.platform)}</span>
                      <span>{minutesLabel(item.mttrMinutes)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-5 border-t border-white/8 pt-4">
              <p className="mb-2 text-sm text-zinc-500">Cumplimiento SLA</p>
              <div className="grid gap-2 sm:grid-cols-4">
                {priorityOrder.map((priority) => {
                  const item = metrics.data.response.sla.find(
                    (entry) => entry.priority === priority,
                  );
                  return (
                    <div
                      key={priority}
                      className="rounded-lg bg-white/4 p-3 text-sm"
                    >
                      <p>{PRIORITY_LABELS[priority]}</p>
                      <p className="mt-1 text-lg font-semibold">
                        {item?.percentage ?? 0}%
                      </p>
                      <p className="text-xs text-zinc-600">
                        {item?.withinSla ?? 0}/{item?.eligible ?? 0} dentro del
                        SLA
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </Section>
          <div className="grid gap-5 xl:grid-cols-2">
            <Section title="Calidad y ownership">
              <div className="space-y-3 text-sm">
                <p>
                  Reaperturas:{' '}
                  <strong className="text-zinc-100">
                    {metrics.data.response.reopened}
                  </strong>
                </p>
                <p>
                  Sin encargado después del umbral:{' '}
                  <strong className="text-zinc-100">
                    {metrics.data.quality.unassignedAfterHours}
                  </strong>
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-white/8 text-xs uppercase tracking-wide text-zinc-500">
                      <tr>
                        <th className="py-2">Plataforma</th>
                        <th className="py-2">Tickets</th>
                        <th className="py-2">
                          <button
                            onClick={() => setSortMttrDesc((value) => !value)}
                          >
                            MTTR {sortMttrDesc ? '↓' : '↑'}
                          </button>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedMttr.map((item) => (
                        <tr
                          key={item.platform}
                          className="border-b border-white/6"
                        >
                          <td className="py-2">
                            {platformLabel(item.platform)}
                          </td>
                          <td className="py-2">{item.count}</td>
                          <td className="py-2">
                            {minutesLabel(item.mttrMinutes)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </Section>
            <Section title="Posibles duplicados">
              <div className="space-y-3">
                {metrics.data.quality.similarGroups.length === 0 && (
                  <p className="text-sm text-zinc-600">
                    No se detectaron títulos repetidos.
                  </p>
                )}
                {metrics.data.quality.similarGroups.map((group) => (
                  <div
                    key={`${group.type}-${group.platform}-${group.signature}`}
                    className="rounded-lg border border-white/6 p-3"
                  >
                    <p className="flex items-center gap-2 text-sm font-medium">
                      <Copy className="size-4 text-blue-300" />
                      {group.count} tickets · {TYPE_LABELS[group.type]} ·{' '}
                      {platformLabel(group.platform)}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">
                      {group.tickets.map((ticket) => ticket.title).join(' · ')}
                    </p>
                  </div>
                ))}
              </div>
            </Section>
          </div>
          <Section title="Tickets estancados">
            <div className="space-y-2">
              {metrics.data.quality.stagnantTickets.length === 0 && (
                <p className="text-sm text-zinc-600">
                  No hay tickets estancados con este umbral.
                </p>
              )}
              {metrics.data.quality.stagnantTickets.map((ticket) => (
                <div
                  key={ticket.id}
                  className="flex flex-wrap justify-between gap-2 border-b border-white/6 pb-2 text-sm"
                >
                  <span>{ticket.title}</span>
                  <span className="text-zinc-500">
                    {STATUS_LABELS[ticket.status as keyof typeof STATUS_LABELS]}{' '}
                    · {new Date(ticket.updatedAt).toLocaleDateString('es-CL')}
                  </span>
                </div>
              ))}
            </div>
          </Section>
        </>
      )}
    </div>
  );
}
