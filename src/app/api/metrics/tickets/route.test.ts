// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getAuthenticatedUser: vi.fn(),
  getTicketMetrics: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  getAuthenticatedUser: mocks.getAuthenticatedUser,
}));
vi.mock('@/lib/metrics/server', () => ({
  getTicketMetrics: mocks.getTicketMetrics,
}));

import { GET } from '@/app/api/metrics/tickets/route';

describe('GET /api/metrics/tickets', () => {
  afterEach(() => vi.clearAllMocks());

  it('rechaza solicitudes no autenticadas', async () => {
    mocks.getAuthenticatedUser.mockResolvedValue(null);

    const response = await GET(
      new Request('http://localhost/api/metrics/tickets'),
    );

    expect(response.status).toBe(401);
    expect(mocks.getTicketMetrics).not.toHaveBeenCalled();
  });

  it('valida filtros y delega la agregación al servicio server-side', async () => {
    mocks.getAuthenticatedUser.mockResolvedValue({ id: 'user-1' });
    mocks.getTicketMetrics.mockResolvedValue({ summary: {} });

    const response = await GET(
      new Request(
        'http://localhost/api/metrics/tickets?rangeDays=7&platform=ATOM&staleDays=5&unassignedHours=8',
      ),
    );

    expect(response.status).toBe(200);
    expect(mocks.getTicketMetrics).toHaveBeenCalledWith({
      rangeDays: 7,
      platform: 'ATOM',
      staleDays: 5,
      unassignedHours: 8,
    });
  });

  it('aplica los valores por defecto cuando no recibe filtros', async () => {
    mocks.getAuthenticatedUser.mockResolvedValue({ id: 'user-1' });
    mocks.getTicketMetrics.mockResolvedValue({});

    const response = await GET(
      new Request('http://localhost/api/metrics/tickets'),
    );

    expect(response.status).toBe(200);
    expect(mocks.getTicketMetrics).toHaveBeenCalledWith({
      rangeDays: 30,
      staleDays: 3,
      unassignedHours: 4,
    });
  });

  it('rechaza parámetros fuera de rango sin consultar la agregación', async () => {
    mocks.getAuthenticatedUser.mockResolvedValue({ id: 'user-1' });

    const response = await GET(
      new Request('http://localhost/api/metrics/tickets?rangeDays=120'),
    );

    expect(response.status).toBe(400);
    expect(mocks.getTicketMetrics).not.toHaveBeenCalled();
  });
});
