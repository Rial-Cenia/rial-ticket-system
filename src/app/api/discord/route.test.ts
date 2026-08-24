// @vitest-environment node
import { generateKeyPairSync, sign } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  callback: vi.fn(),
  edit: vi.fn(),
  followup: vi.fn(),
  createTicket: vi.fn(),
  updateTicket: vi.fn(),
  getTicket: vi.fn(),
  processJobs: vi.fn(),
  rpc: vi.fn(),
  discordEnv: vi.fn(),
  order: [] as string[],
}));

vi.mock('@/lib/discord/client', () => ({
  callbackInteraction: mocks.callback,
  editInteractionResponse: mocks.edit,
  followupInteraction: mocks.followup,
}));
vi.mock('@/lib/discord/jobs', () => ({ processOutboxJobs: mocks.processJobs }));
vi.mock('@/lib/discord/roles', () => ({
  platformRoleId: () => 'platform-role',
}));
vi.mock('@/lib/env/server', () => ({ getDiscordEnv: mocks.discordEnv }));
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ rpc: mocks.rpc }),
}));
vi.mock('@/lib/tickets/server', () => ({
  createTicket: mocks.createTicket,
  updateTicket: mocks.updateTicket,
  getTicket: mocks.getTicket,
}));

import { POST } from '@/app/api/discord/route';

const { privateKey, publicKey } = generateKeyPairSync('ed25519');
const rawPublicKey = publicKey
  .export({ type: 'spki', format: 'der' })
  .subarray(-32)
  .toString('hex');

function signedRequest(payload: object, withHeaders = true) {
  const body = JSON.stringify(payload);
  const timestamp = '1724500000';
  const signature = sign(
    null,
    Buffer.from(timestamp + body),
    privateKey,
  ).toString('hex');
  return new Request('http://localhost/api/discord', {
    method: 'POST',
    body,
    headers: withHeaders
      ? {
          'content-type': 'application/json',
          'x-signature-ed25519': signature,
          'x-signature-timestamp': timestamp,
        }
      : { 'content-type': 'application/json' },
  });
}

describe('Discord interaction route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.order.length = 0;
    mocks.discordEnv.mockReturnValue({
      publicKey: rawPublicKey,
      guildId: 'guild-1',
      triagerRoleId: 'triager-role',
    });
    mocks.callback.mockImplementation(async () => {
      mocks.order.push('ack');
    });
    mocks.edit.mockResolvedValue(undefined);
    mocks.followup.mockResolvedValue(undefined);
    mocks.processJobs.mockResolvedValue({
      claimed: 1,
      delivered: 1,
      failed: 0,
    });
    mocks.rpc.mockResolvedValue({ data: true, error: null });
    mocks.createTicket.mockImplementation(async () => {
      mocks.order.push('database');
      return {
        id: 42,
        publicId: '3d7b8cb4-4eaf-4d9a-ae97-1c3c807d8c71',
        title: 'Error crítico',
      };
    });
  });

  it('rechaza headers de firma ausentes', async () => {
    const response = await POST(
      signedRequest(
        { id: '1', application_id: 'app', token: 'token', type: 1 },
        false,
      ),
    );
    expect(response.status).toBe(401);
  });

  it('responde PONG a un PING firmado', async () => {
    const response = await POST(
      signedRequest({
        id: '1',
        application_id: 'app',
        token: 'token',
        type: 1,
      }),
    );
    await expect(response.json()).resolves.toEqual({ type: 1 });
  });

  it('abre el modal desde el botón fijo', async () => {
    const response = await POST(
      signedRequest({
        id: '2',
        application_id: 'app',
        token: 'token',
        type: 3,
        guild_id: 'guild-1',
        data: { custom_id: 'open_ticket_modal' },
      }),
    );
    await expect(response.json()).resolves.toMatchObject({
      type: 9,
      data: { custom_id: 'create_ticket_modal' },
    });
  });

  it('envía el ACK diferido antes de crear el ticket del modal', async () => {
    const response = await POST(
      signedRequest({
        id: '3',
        application_id: 'app',
        token: 'token',
        type: 5,
        guild_id: 'guild-1',
        member: {
          roles: [],
          user: { id: 'user-1', username: 'operaciones' },
        },
        data: {
          custom_id: 'create_ticket_modal',
          components: [
            {
              type: 18,
              component: { custom_id: 'ticket_title', value: 'Error crítico' },
            },
            {
              type: 18,
              component: {
                custom_id: 'ticket_description',
                value: 'No carga la pantalla',
              },
            },
            {
              type: 18,
              component: { custom_id: 'ticket_type', values: ['BUG'] },
            },
          ],
        },
      }),
    );

    expect(response.status).toBe(202);
    expect(mocks.order).toEqual(['ack', 'database']);
    expect(mocks.createTicket).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'BUG' }),
      'DISCORD',
      expect.objectContaining({ id: 'user-1' }),
    );
  });

  it('asigna la plataforma sin cambiar el estado pendiente', async () => {
    const ticket = {
      id: 42,
      publicId: '3d7b8cb4-4eaf-4d9a-ae97-1c3c807d8c71',
      title: 'Error crítico',
      description: 'No carga',
      type: 'BUG',
      status: 'PENDIENTE',
      platform: 'NESTOR',
      createdByName: 'Operaciones',
      createdByDiscordId: 'creator-1',
      discordThreadId: 'thread-1',
      createdAt: '2026-08-24T12:00:00.000Z',
      updatedAt: '2026-08-24T13:00:00.000Z',
    } as const;
    mocks.updateTicket.mockResolvedValue(ticket);

    const response = await POST(
      signedRequest({
        id: '4',
        application_id: 'app',
        token: 'token',
        type: 3,
        guild_id: 'guild-1',
        member: {
          roles: ['triager-role'],
          user: { id: 'triager-1', username: 'barbilla-roja' },
        },
        data: {
          custom_id: 'triage_platform_3d7b8cb4-4eaf-4d9a-ae97-1c3c807d8c71',
          values: ['NESTOR'],
        },
      }),
    );

    expect(response.status).toBe(202);
    expect(mocks.updateTicket).toHaveBeenCalledWith(
      ticket.publicId,
      { platform: 'NESTOR' },
      'DISCORD',
      expect.objectContaining({ id: 'triager-1' }),
    );
    expect(mocks.followup).toHaveBeenCalledWith(
      'app',
      'token',
      expect.objectContaining({
        content: expect.stringContaining('se mantiene en **Pendiente**'),
      }),
    );
  });

  it('permite volver a pendiente y menciona al creador del ticket', async () => {
    const current = {
      id: 42,
      publicId: '3d7b8cb4-4eaf-4d9a-ae97-1c3c807d8c71',
      title: 'Error crítico',
      description: 'No carga',
      type: 'BUG',
      status: 'EN_PROGRESO',
      platform: 'NESTOR',
      createdByName: 'Operaciones',
      createdByDiscordId: 'creator-1',
      discordThreadId: 'thread-1',
      createdAt: '2026-08-24T12:00:00.000Z',
      updatedAt: '2026-08-24T13:00:00.000Z',
    } as const;
    mocks.getTicket.mockResolvedValue(current);
    mocks.updateTicket.mockResolvedValue({ ...current, status: 'PENDIENTE' });

    const response = await POST(
      signedRequest({
        id: '4',
        application_id: 'app',
        token: 'token',
        type: 3,
        guild_id: 'guild-1',
        member: {
          roles: ['platform-role'],
          user: { id: 'operator-1', username: 'operaciones' },
        },
        data: {
          custom_id: 'status_PENDIENTE_3d7b8cb4-4eaf-4d9a-ae97-1c3c807d8c71',
        },
      }),
    );

    expect(response.status).toBe(202);
    expect(mocks.updateTicket).toHaveBeenCalledWith(
      current.publicId,
      { status: 'PENDIENTE' },
      'DISCORD',
      expect.objectContaining({ id: 'operator-1' }),
    );
    expect(mocks.followup).toHaveBeenCalledWith(
      'app',
      'token',
      expect.objectContaining({
        content: expect.stringContaining('<@creator-1>'),
        allowed_mentions: { parse: [], users: ['creator-1'] },
      }),
    );
  });
});
