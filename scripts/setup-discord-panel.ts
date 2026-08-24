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
  content:
    '## Ticketera Rial\n¿Necesitas soporte? Presiona el botón para crear un ticket.',
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
