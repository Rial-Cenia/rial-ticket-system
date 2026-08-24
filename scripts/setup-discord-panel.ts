import { loadEnvFile } from 'node:process';

try {
  loadEnvFile('.env.local');
} catch {
  loadEnvFile('.env');
}

const token = process.env.DISCORD_BOT_TOKEN;
const channelId = process.env.DISCORD_TRIAGE_CHANNEL_ID;
const messageId = process.env.DISCORD_PANEL_MESSAGE_ID;
if (!token || !channelId)
  throw new Error('Configura DISCORD_BOT_TOKEN y DISCORD_TRIAGE_CHANNEL_ID');

const payload = {
  content: `🌸・゜゜・。。・゜゜・🌸

## 🎟️ ୨୧ Ticketera Rial ୨୧ 🎟️

¿Necesitas una ayudita, bestie? (｡•́︿•̀｡)
Tranqui, no entres en pánico ni te quedes en modo NPC 💀✨
¡El team Rial está aquí para salvar el día y servir soporte! 💅🏻

Presiona el botoncito de abajo para crear tu ticket 🎀
Cuéntanos todo el chisme con lujo de detalle y te ayudaremos lo antes posible, porque ignorarte sería tremendo red flag 🚩 y nosotros sí somos muy slay, uwu ദ്ദി(˵ •̀ ᴗ - ˵ ) ✧

### 🎫 Crear ticket, bestie ʕ•́ᴥ•̀ʔっ♡

✨ Dale clic sin miedo, que el soporte sí resuelve ✨
No ticket = no ayuda, bebé. Matemáticas básicas 💋

🌸・゜゜・。。・゜゜・🌸`,
  components: [
    {
      type: 1,
      components: [
        {
          type: 2,
          style: 1,
          label: 'Crear ticket',
          custom_id: 'open_ticket_modal',
          emoji: { name: '🎫' },
        },
      ],
    },
  ],
  allowed_mentions: { parse: [] },
};
const path = messageId
  ? `/channels/${channelId}/messages/${messageId}`
  : `/channels/${channelId}/messages`;
const response = await fetch(`https://discord.com/api/v10${path}`, {
  method: messageId ? 'PATCH' : 'POST',
  headers: {
    authorization: `Bot ${token}`,
    'content-type': 'application/json',
  },
  body: JSON.stringify(payload),
});
const body = (await response.json()) as { id?: string; message?: string };
if (!response.ok || !body.id)
  throw new Error(body.message ?? `Discord respondió ${response.status}`);
console.log(`Panel configurado. DISCORD_PANEL_MESSAGE_ID=${body.id}`);
