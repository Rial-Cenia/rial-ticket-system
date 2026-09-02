// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createOrUpdatePanel: vi.fn(),
  serverEnv: vi.fn(),
}));

vi.mock('@/lib/discord/client', () => ({
  createOrUpdatePanel: mocks.createOrUpdatePanel,
}));
vi.mock('@/lib/env/server', () => ({ getServerEnv: mocks.serverEnv }));

import { POST } from '@/app/api/discord/panel/route';

function request(secret?: string) {
  return new Request('http://localhost/api/discord/panel', {
    method: 'POST',
    headers: secret ? { authorization: `Bearer ${secret}` } : {},
  });
}

describe('Discord panel cron route', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mocks.serverEnv.mockReturnValue({
      CRON_SECRET: 'cron-secret',
      DISCORD_PANEL_MESSAGE_ID: 'panel-message',
    });
    mocks.createOrUpdatePanel.mockResolvedValue({ id: 'panel-message' });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('rechaza solicitudes sin el secreto del cron', async () => {
    const response = await POST(request());

    expect(response.status).toBe(401);
    expect(mocks.createOrUpdatePanel).not.toHaveBeenCalled();
  });

  it('actualiza el panel a las 09:00 de un día hábil en Chile', async () => {
    vi.setSystemTime(new Date('2026-06-01T13:00:00.000Z'));

    const response = await POST(request('cron-secret'));

    await expect(response.json()).resolves.toEqual({
      messageId: 'panel-message',
    });
    expect(mocks.createOrUpdatePanel).toHaveBeenCalledWith(
      expect.objectContaining({
        components: expect.arrayContaining([
          expect.objectContaining({
            components: expect.arrayContaining([
              expect.objectContaining({ custom_id: 'open_ticket_modal' }),
            ]),
          }),
        ]),
      }),
      'panel-message',
    );
  });

  it('omite la ejecución fuera de las 09:00 de Chile', async () => {
    vi.setSystemTime(new Date('2026-06-01T12:00:00.000Z'));

    const response = await POST(request('cron-secret'));

    await expect(response.json()).resolves.toEqual({ skipped: true });
    expect(mocks.createOrUpdatePanel).not.toHaveBeenCalled();
  });

  it('omite la ejecución de fin de semana', async () => {
    vi.setSystemTime(new Date('2026-06-06T13:00:00.000Z'));

    const response = await POST(request('cron-secret'));

    await expect(response.json()).resolves.toEqual({ skipped: true });
    expect(mocks.createOrUpdatePanel).not.toHaveBeenCalled();
  });

  it('exige un mensaje de panel existente para evitar duplicados', async () => {
    vi.setSystemTime(new Date('2026-06-01T13:00:00.000Z'));
    mocks.serverEnv.mockReturnValue({ CRON_SECRET: 'cron-secret' });

    const response = await POST(request('cron-secret'));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: 'Falta DISCORD_PANEL_MESSAGE_ID',
    });
    expect(mocks.createOrUpdatePanel).not.toHaveBeenCalled();
  });
});
