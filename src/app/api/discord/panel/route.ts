import { ticketPanelMessage } from '@/lib/discord/components';
import { createOrUpdatePanel } from '@/lib/discord/client';
import { getServerEnv } from '@/lib/env/server';
import { apiError } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isChileWeekdayAtNine(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Santiago',
    weekday: 'short',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );

  return (
    values.hour === '09' && values.weekday !== 'Sat' && values.weekday !== 'Sun'
  );
}

export async function POST(request: Request) {
  const env = getServerEnv();
  if (
    !env.CRON_SECRET ||
    request.headers.get('authorization') !== `Bearer ${env.CRON_SECRET}`
  ) {
    return Response.json({ error: 'No autorizado' }, { status: 401 });
  }

  if (!isChileWeekdayAtNine()) {
    return Response.json({ skipped: true });
  }

  if (!env.DISCORD_PANEL_MESSAGE_ID) {
    return Response.json(
      { error: 'Falta DISCORD_PANEL_MESSAGE_ID' },
      { status: 500 },
    );
  }

  try {
    const message = await createOrUpdatePanel(
      ticketPanelMessage(),
      env.DISCORD_PANEL_MESSAGE_ID,
    );
    return Response.json({ messageId: message.id });
  } catch (error) {
    return apiError(error);
  }
}
