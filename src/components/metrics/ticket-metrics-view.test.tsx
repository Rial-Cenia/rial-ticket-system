import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TicketMetrics } from '@/lib/metrics/types';

const mocks = vi.hoisted(() => ({ useTicketMetrics: vi.fn() }));

vi.mock('@/hooks/use-ticket-metrics', () => ({
  useTicketMetrics: mocks.useTicketMetrics,
}));

import { TicketMetricsView } from '@/components/metrics/ticket-metrics-view';

const metrics: TicketMetrics = {
  rangeDays: 30,
  summary: { openHighToday: 4, unassigned: 3, stagnant: 2 },
  volume: {
    createdByPlatform: [{ platform: 'ATOM', count: 8 }],
    urgencyByPlatform: [{ platform: 'ATOM', priority: 'ALTA', count: 4 }],
    typeDistribution: [{ type: 'BUG', count: 5 }],
    weeklyTrend: [{ week: '2026-09-14', created: 3, resolved: 2 }],
  },
  response: {
    ttaMinutes: 45,
    ttrByPriority: [{ priority: 'ALTA', count: 2, mttrMinutes: 120 }],
    ttrByPlatform: [{ platform: 'ATOM', count: 2, mttrMinutes: 120 }],
    sla: [{ priority: 'ALTA', eligible: 2, withinSla: 1, percentage: 50 }],
    reopened: 1,
  },
  quality: {
    mttrByPlatform: [{ platform: 'ATOM', count: 2, mttrMinutes: 120 }],
    unassignedAfterHours: 1,
    stagnantTickets: [
      {
        id: 'ticket-1',
        title: 'Ticket estancado',
        status: 'EN_PROGRESO',
        updatedAt: '2026-09-10T12:00:00.000Z',
      },
    ],
    similarGroups: [
      {
        type: 'BUG',
        platform: 'ATOM',
        count: 2,
        signature: 'error login',
        tickets: [{ id: 'ticket-1', title: 'Error login' }],
      },
    ],
  },
};

function renderView() {
  const client = new QueryClient();
  return render(
    <QueryClientProvider client={client}>
      <TicketMetricsView />
    </QueryClientProvider>,
  );
}

describe('TicketMetricsView', () => {
  afterEach(() => cleanup());

  it('muestra el resumen y las principales secciones de métricas', () => {
    mocks.useTicketMetrics.mockReturnValue({
      data: metrics,
      isLoading: false,
      error: null,
    });

    renderView();

    expect(
      screen.getByRole('heading', { name: 'Resumen operativo' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Abiertos urgentes hoy')).toBeInTheDocument();
    expect(screen.getByText('4', { selector: 'p' })).toBeInTheDocument();
    expect(screen.getByText('Tiempos de respuesta')).toBeInTheDocument();
    expect(screen.getByText('Posibles duplicados')).toBeInTheDocument();
    expect(screen.getByText('Ticket estancado')).toBeInTheDocument();
  });

  it('muestra el estado de carga', () => {
    mocks.useTicketMetrics.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    });

    renderView();

    expect(
      screen.queryByRole('heading', { name: 'Resumen operativo' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Tiempos de respuesta')).not.toBeInTheDocument();
  });
});
