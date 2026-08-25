import { getAuthenticatedUser } from '@/lib/auth';
import { getThreadMessages } from '@/lib/discord/client';
import { getDiscordEnv } from '@/lib/env/server';
import { apiError } from '@/lib/http';
import { getTicket } from '@/lib/tickets/server';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ publicId: string }> },
) {
  const user = await getAuthenticatedUser();
  if (!user) return Response.json({ error: 'No autenticado' }, { status: 401 });

  try {
    const { publicId } = await params;
    const ticket = await getTicket(publicId);
    if (!ticket) {
      return Response.json({ error: 'Ticket no encontrado' }, { status: 404 });
    }
    if (!ticket.discordThreadId) {
      return Response.json(
        { error: 'El ticket no tiene chat de Discord' },
        { status: 404 },
      );
    }

    const { guildId } = getDiscordEnv();
    const messages = await getThreadMessages(ticket.discordThreadId);
    return Response.json({
      data: {
        threadUrl: `https://discord.com/channels/${guildId}/${ticket.discordThreadId}`,
        messages,
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
