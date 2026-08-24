import { describe, expect, it } from 'vitest';
import {
  statusUpdateMessage,
  ticketControls,
  ticketPanelMessage,
  triageMessage,
} from '@/lib/discord/components';
import type { Ticket } from '@/lib/types';

const ticket: Ticket = {
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
};

describe('Discord ticket components', () => {
  it('mantiene sincronizado el mensaje del panel de tickets', () => {
    const message = ticketPanelMessage();

    expect(message.content).toBe(`🌸・゜゜・。。・゜゜・🌸

## 🎟️ ୨୧ Ticketera Rial ୨୧ 🎟️

¿Necesitas una ayudita, bestie? (｡•́︿•̀｡)
Tranqui, no entres en pánico ni te quedes en modo NPC 💀✨
¡El team Rial está aquí para salvar el día y servir soporte! 💅🏻

Presiona el botoncito de abajo para crear tu ticket 🎀
Cuéntanos todo el chisme con lujo de detalle y te ayudaremos lo antes posible, porque ignorarte sería tremendo red flag 🚩 y nosotros sí somos muy slay, uwu ദ്ദി(˵ •̀ ᴗ - ˵ ) ✧

### 🎫 Crear ticket, bestie ʕ•́ᴥ•̀ʔっ♡

✨ Dale clic sin miedo, que el soporte sí resuelve ✨
No ticket = no ayuda, bebé. Matemáticas básicas 💋

🌸・゜゜・。。・゜゜・🌸`);
    expect(message).toMatchObject({
      components: [
        {
          components: [
            {
              label: 'Crear ticket',
              custom_id: 'open_ticket_modal',
            },
          ],
        },
      ],
    });
  });

  it('notifica al rol de triage sobre el ticket nuevo', () => {
    const message = triageMessage(ticket, 'triager-role');

    expect(message.content)
      .toBe(`🚨 **¡Nueva side quest desbloqueada, equipo!** 🚨

<@&triager-role>, apareció un ticket pendiente de triage 📩✨

Necesita plataforma y un valiente que lo adopte antes de que empiece su arco de abandono (｡•́︿•̀｡)💔

Échenle una miradita y decidan su destino, besties. **El ticket no se va a triajar solo** 💅🏻🎀`);
    expect(message.allowed_mentions).toEqual({
      parse: [],
      roles: ['triager-role'],
    });
  });

  it('muestra el código RTP en los mensajes', () => {
    expect(JSON.stringify(triageMessage(ticket, 'triager-role'))).toContain(
      'RTP-42',
    );
    expect(
      JSON.stringify(ticketControls(ticket, 'Operaciones', 'platform-role')),
    ).toContain('RTP-42');
  });

  it.each([
    [
      'EN_PROGRESO',
      `🔄 **¡Tenemos movimiento en el Kanban!** 🛹✨
**Operaciones** actualizó el ticket \`RTP-42\` y ahora está **EN PROGRESO** 🚧
La quest ha comenzado, besties. Alguien ya se puso la 10 y está cocinando una solución, uwu 🍳🔥`,
    ],
    [
      'PENDIENTE',
      `⏳ **Mini pausa administrativa** (｡•́︿•̀｡)
El ticket \`RTP-42\` fue actualizado por **Operaciones** y quedó **PENDIENTE** 🎀
Todavía no entra al horno, pero ya está haciendo fila educadamente. Paciencia, bestie: su momento slay llegará 🧍✨`,
    ],
    [
      'EN_STAGING',
      `🧪 **¡Entramos en la era de las pruebibas!** ✨
**Operaciones** movió el ticket \`RTP-42\` a **EN STAGING** 🧑‍🔬🎀
La solución ya está en su ensayo general: probando el outfit antes de salir a producción 💃🏻
Manifestando cero bugs, uwu 🕯️ʕ•́ᴥ•̀ʔっ`,
    ],
    [
      'RESUELTO',
      `🎉 **¡Caso cerrado, criaturas!** 🎉
El ticket \`RTP-42\` fue marcado como **RESUELTO** por **Operaciones** ✅💖
El problema fue derrotado, la paz regresó al reino y el team sirvió desarrollo con éxito 💅🏻✨
Common support W, besties ʕっ•ᴥ•ʔっ♡`,
    ],
    [
      'EN_ESPERA',
      `🛑 **El ticket entró en modo “ahí te aviso”** 🧍🏻‍♀️💭
**Operaciones** cambió el estado de \`RTP-42\` a **EN ESPERA** ⏸️🎀
Por ahora toca hacer una pausita dramática y aguardar novedades…
No está olvidado, solo está teniendo su training arc, uwu 🌸✨`,
    ],
  ] as const)(
    'formatea la notificación para el estado %s',
    (status, expected) => {
      expect(statusUpdateMessage({ ...ticket, status }, 'Operaciones')).toBe(
        expected,
      );
    },
  );

  it('incluye botones para los cuatro estados', () => {
    const payload = JSON.stringify(
      ticketControls(ticket, 'Operaciones', 'platform-role'),
    );
    for (const status of [
      'PENDIENTE',
      'EN_PROGRESO',
      'EN_STAGING',
      'EN_ESPERA',
      'RESUELTO',
    ]) {
      expect(payload).toContain(`status_${status}_${ticket.publicId}`);
    }
  });
});
