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

  it('rechaza interacciones de un servidor no habilitado', async () => {
    const response = await POST(
      signedRequest({
        id: 'wrong-guild-1',
        application_id: 'app',
        token: 'token',
        type: 3,
        guild_id: 'guild-2',
        member: {
          roles: [],
          user: { id: 'user-1', username: 'operaciones' },
        },
        data: { custom_id: 'open_ticket_modal' },
      }),
    );

    await expect(response.json()).resolves.toMatchObject({
      data: {
        content: `🤖💤 **Este bot no vive aquí, bestie…**
No está habilitado en este servidor (｡•́︿•̀｡)💔
Toca activarlo antes de invocarlo, porque por ahora está en modo fantasma: cero presencia, cero servicio, cero aura administrativa 👻🎀`,
        allowed_mentions: { parse: [] },
      },
    });
    expect(mocks.createTicket).not.toHaveBeenCalled();
    expect(mocks.updateTicket).not.toHaveBeenCalled();
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

  it('responde cuando la interacción no está soportada', async () => {
    const response = await POST(
      signedRequest({
        id: 'unsupported-1',
        application_id: 'app',
        token: 'token',
        type: 3,
        guild_id: 'guild-1',
        member: {
          roles: [],
          user: { id: 'user-1', username: 'operaciones' },
        },
        data: { custom_id: 'unknown_action' },
      }),
    );

    await expect(response.json()).resolves.toMatchObject({
      data: {
        content: `🚫🎮 **Esa interacción todavía no está desbloqueada, bestie**
El bot no sabe qué hacer con ella y quedó en modo confundido (⊙_⊙;)💭
Prueba otra opción antes de que tenga una crisis existencial digital, uwu 🤖🎀`,
        allowed_mentions: { parse: [] },
      },
    });
    expect(mocks.createTicket).not.toHaveBeenCalled();
    expect(mocks.updateTicket).not.toHaveBeenCalled();
  });

  it('envía el ACK diferido y comunica cuando la sincronización queda en cola', async () => {
    mocks.processJobs.mockResolvedValueOnce({
      claimed: 1,
      delivered: 0,
      failed: 1,
    });

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
    expect(mocks.edit).toHaveBeenCalledWith('app', 'token', {
      content: `✅ ¡Ticket **Error crítico** creado, bestie! ദ്ദി(˵ •̀ ᴗ - ˵ ) ✧
Tu codiguito es \`RTP-42\` 🎟️💕
🧵✨ **El hilito entró en la fila de sincronización**
Está esperando su turno muy educadamente, bestie (˶ᵔ ᵕ ᵔ˶)🎀
En cuanto le toque, hará *sync* y quedará todo divino, uwu 💅🏻
Ahora toca esperar a que el team haga su magia y sirva soporte 💅✨
Ticket creado = momento slay. Cero bugs, pura gestión 🎀`,
      allowed_mentions: { parse: [] },
    });
  });

  it('responde con el mensaje de error cuando no puede crear el ticket', async () => {
    mocks.createTicket.mockRejectedValueOnce(new Error('Database unavailable'));

    const response = await POST(
      signedRequest({
        id: 'error-1',
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
    expect(mocks.edit).toHaveBeenCalledWith('app', 'token', {
      content: `❌ **Uy, bestie… el ticket no quiso cooperar** (╥﹏╥)💔
No fue posible crearlo por este dramita técnico: \`Database unavailable\` 🛠️
Inténtalo otra vez en un momentito. Si sigue fallando, habrá que invocar al team técnico antes de que esto se convierta en tremendo evento canónico, uwu 🕯️✨`,
      allowed_mentions: { parse: [] },
    });
  });

  it('rechaza el triage cuando el usuario no tiene el rol requerido', async () => {
    const response = await POST(
      signedRequest({
        id: 'triage-denied-1',
        application_id: 'app',
        token: 'token',
        type: 3,
        guild_id: 'guild-1',
        member: {
          roles: [],
          user: { id: 'user-1', username: 'operaciones' },
        },
        data: {
          custom_id: 'triage_platform_3d7b8cb4-4eaf-4d9a-ae97-1c3c807d8c71',
          values: ['NESTOR'],
        },
      }),
    );

    await expect(response.json()).resolves.toMatchObject({
      data: {
        content: `🚫 **Alto ahí, bestie** ✋(˵ •̀ ᴗ •́ ˵ )
Solo **Barbilla Roja 👹** tiene el poder ancestral para asignar la plataforma 🔮✨
El resto somos simples mortales sin esos permisos, uwu. Toca invocarlo y esperar que responda al llamado 📣🕯️`,
        allowed_mentions: { parse: [] },
      },
    });
    expect(mocks.updateTicket).not.toHaveBeenCalled();
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
    expect(mocks.followup).toHaveBeenCalledWith('app', 'token', {
      content: `<@creator-1> 🎀 Plot twist administrativo 🎀
El ticket \`RTP-42\` encontró a su humano designado: **🌸 Nestor** (づ｡◕‿‿◕｡)づ📋
Por ahora sigue en estado **⏳ Pendientito** ⏳
O sea, ya tiene dueño… pero la quest todavía no comienza, uwu 🎮✨
**🌸 Nestor**, te tocó cocinar, bestie 👨‍🍳🔥`,
      allowed_mentions: { parse: [], users: ['creator-1'] },
    });
  });

  it('responde con el mensaje de error cuando no puede asignar el ticket', async () => {
    mocks.updateTicket.mockRejectedValueOnce(new Error('Invalid platform'));

    const response = await POST(
      signedRequest({
        id: 'triage-error-1',
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
    expect(mocks.followup).toHaveBeenCalledWith('app', 'token', {
      content: `❌ **La asignación no pasó el vibe check** (｡•́︿•̀｡)💔
No fue posible asignar el ticket por el siguiente dramita: \`Invalid platform\` 🛠️
Revisa los datos e inténtalo nuevamente, bestie. El ticket sigue esperando a su persona elegida 👉👈🎟️✨`,
      flags: 64,
      allowed_mentions: { parse: [] },
    });
    expect(mocks.edit).not.toHaveBeenCalled();
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
        content: expect.stringContaining(
          '<@creator-1> ⏳ **Mini pausa administrativa**',
        ),
        allowed_mentions: { parse: [], users: ['creator-1'] },
      }),
    );
  });

  it('rechaza el cambio de estado cuando el ticket no tiene plataforma', async () => {
    mocks.getTicket.mockResolvedValue({
      id: 42,
      publicId: '3d7b8cb4-4eaf-4d9a-ae97-1c3c807d8c71',
      title: 'Error crítico',
      description: 'No carga',
      type: 'BUG',
      status: 'PENDIENTE',
      platform: null,
      createdByName: 'Operaciones',
      createdByDiscordId: 'creator-1',
      discordThreadId: 'thread-1',
      createdAt: '2026-08-24T12:00:00.000Z',
      updatedAt: '2026-08-24T13:00:00.000Z',
    });

    const response = await POST(
      signedRequest({
        id: 'status-without-platform-1',
        application_id: 'app',
        token: 'token',
        type: 3,
        guild_id: 'guild-1',
        member: {
          roles: ['triager-role'],
          user: { id: 'triager-1', username: 'barbilla-roja' },
        },
        data: {
          custom_id: 'status_EN_PROGRESO_3d7b8cb4-4eaf-4d9a-ae97-1c3c807d8c71',
        },
      }),
    );

    expect(response.status).toBe(202);
    expect(mocks.followup).toHaveBeenCalledWith('app', 'token', {
      content: `❌ **El cambio de estado hizo flop, bestie** (╥﹏╥)💥
No fue posible actualizarlo por este pequeño escándalo técnico: \`🫣 **Bestie, aquí falta un detallito importante…**
El ticket todavía no tiene una **plataforma** asignada (｡•́︿•̀｡)💻
Primero hay que ponerle una, porque enviarlo así sería soltarlo al mundo sin contexto ni supervisión parental, uwu 🎀✨\` 🛠️🎀
Inténtalo nuevamente cuando los astros del Kanban estén alineados, uwu 🕯️✨`,
      flags: 64,
      allowed_mentions: { parse: [] },
    });
    expect(mocks.updateTicket).not.toHaveBeenCalled();
  });

  it('rechaza el cambio de estado cuando el ticket no existe', async () => {
    mocks.getTicket.mockResolvedValue(null);

    const response = await POST(
      signedRequest({
        id: 'status-missing-ticket-1',
        application_id: 'app',
        token: 'token',
        type: 3,
        guild_id: 'guild-1',
        member: {
          roles: ['triager-role'],
          user: { id: 'triager-1', username: 'barbilla-roja' },
        },
        data: {
          custom_id: 'status_EN_PROGRESO_3d7b8cb4-4eaf-4d9a-ae97-1c3c807d8c71',
        },
      }),
    );

    expect(response.status).toBe(202);
    expect(mocks.followup).toHaveBeenCalledWith('app', 'token', {
      content: `❌ **El cambio de estado hizo flop, bestie** (╥﹏╥)💥
No fue posible actualizarlo por este pequeño escándalo técnico: \`🔍💔 **Bestie… ese ticket no existe en este plano astral**
No pudimos encontrarlo por ningún lado (｡•́︿•̀｡)
Revisa el código e inténtalo otra vez, porque parece que hizo *ghosting*, uwu 👻🎀\` 🛠️🎀
Inténtalo nuevamente cuando los astros del Kanban estén alineados, uwu 🕯️✨`,
      flags: 64,
      allowed_mentions: { parse: [] },
    });
    expect(mocks.updateTicket).not.toHaveBeenCalled();
    expect(mocks.edit).not.toHaveBeenCalled();
  });

  it('rechaza el cambio de estado cuando el usuario no tiene permisos', async () => {
    mocks.getTicket.mockResolvedValue({
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
    });

    const response = await POST(
      signedRequest({
        id: 'status-denied-1',
        application_id: 'app',
        token: 'token',
        type: 3,
        guild_id: 'guild-1',
        member: {
          roles: [],
          user: { id: 'user-1', username: 'operaciones' },
        },
        data: {
          custom_id: 'status_EN_PROGRESO_3d7b8cb4-4eaf-4d9a-ae97-1c3c807d8c71',
        },
      }),
    );

    expect(response.status).toBe(202);
    expect(mocks.followup).toHaveBeenCalledWith('app', 'token', {
      content: `🚨 **Amix, ese botoncito no es para ti** ( •́ ᴖ •̀ )💔
No tienes los permisos necesarios para cambiar el estado de este ticket 🔒✨
Toca invocar a alguien con más aura administrativa, porque el sistema te dijo: **“hasta aquí llegaste, bestie”**, uwu 🫵🏻🎀`,
      flags: 64,
      allowed_mentions: { parse: [] },
    });
    expect(mocks.updateTicket).not.toHaveBeenCalled();
    expect(mocks.edit).not.toHaveBeenCalled();
  });
});
