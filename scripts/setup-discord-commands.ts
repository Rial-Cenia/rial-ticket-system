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
    name: 'botuki',
    description: 'Control Botuki from a Rial ticket thread',
    options: [
      {
        type: 1,
        name: 'analyze',
        description: 'Analyze the ticket and select its repository',
        options: [
          {
            type: 3,
            name: 'repository',
            description: 'Optional repository override',
            required: false,
            choices: [
              { name: 'frontend', value: 'frontend' },
              { name: 'backend', value: 'backend' },
              { name: 'workers', value: 'workers' },
              { name: 'platform-docker', value: 'platform-docker' },
            ],
          },
        ],
      },
      {
        type: 1,
        name: 'implement',
        description: 'Start an eligible implementation',
      },
      { type: 1, name: 'retry', description: 'Retry a finished Botuki run' },
      { type: 1, name: 'cancel', description: 'Cancel the current Botuki run' },
      {
        type: 1,
        name: 'answer',
        description: 'Answer a Botuki analysis question',
        options: [
          {
            type: 3,
            name: 'message',
            description: 'Your clarification for Botuki',
            required: true,
            max_length: 1000,
          },
        ],
      },
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
