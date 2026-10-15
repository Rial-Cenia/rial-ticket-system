import { loadEnvFile } from 'node:process';

try {
  loadEnvFile('.env.local');
} catch {
  try {
    loadEnvFile('.env');
  } catch {
    // The deployment environment may already provide all variables.
  }
}

const API = 'https://discord.com/api/v10';

const commands = [
  {
    name: 'codex',
    description: 'Control Botuki from a Rial ticket thread',
    options: [
      { type: 1, name: 'analyze', description: 'Request a ticket analysis' },
      {
        type: 1,
        name: 'status',
        description: 'Show the current Botuki status',
      },
      { type: 1, name: 'stop', description: 'Cancel the current Botuki run' },
      {
        type: 1,
        name: 'implement',
        description: 'Start an approved implementation',
      },
      { type: 1, name: 'retry', description: 'Retry a finished Botuki run' },
    ],
  },
];

const clientId = process.env.DISCORD_CLIENT_ID;
const botToken = process.env.DISCORD_BOT_TOKEN;
const guildId = process.env.DISCORD_GUILD_ID;
if (!clientId || !botToken || !guildId)
  throw new Error(
    'Configura DISCORD_CLIENT_ID, DISCORD_BOT_TOKEN y DISCORD_GUILD_ID',
  );
const response = await fetch(
  `${API}/applications/${clientId}/guilds/${guildId}/commands`,
  {
    method: 'PUT',
    headers: {
      authorization: `Bot ${botToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(commands),
  },
);

if (!response.ok) {
  const body = await response.text();
  throw new Error(`Discord rechazó los comandos (${response.status}): ${body}`);
}

console.log(
  `Registrados ${commands.length} comandos de Botuki en el guild ${guildId}`,
);
