import { requireApiUser } from '@/lib/api/auth';
import { apiError } from '@/lib/http';
import { platformSchema } from '@/lib/schemas';
import {
  listDiscordRoleConnections,
  listTeamPlatforms,
  removeDiscordRoleConnection,
  removeTeamPlatform,
  saveDiscordRoleConnection,
  saveTeamPlatform,
} from '@/lib/ticket-scope/server';
import { z } from 'zod';

const teamPlatformSchema = z.object({
  teamId: z.string().uuid(),
  platform: platformSchema,
});
const roleConnectionSchema = z
  .object({
    roleId: z.string().min(1),
    roleName: z.string().trim().min(1).max(100),
    platform: platformSchema.nullable(),
    teamId: z.string().uuid().nullable(),
  })
  .refine(
    (value) => value.platform !== null || value.teamId !== null,
    'Selecciona una plataforma o un equipo',
  );

export async function GET() {
  try {
    await requireApiUser();
    const [teamPlatforms, roleConnections] = await Promise.all([
      listTeamPlatforms(),
      listDiscordRoleConnections(),
    ]);
    return Response.json({ data: { teamPlatforms, roleConnections } });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireApiUser();
    const body = await request.json();
    if (body.kind === 'team-platform') {
      const input = teamPlatformSchema.parse(body);
      await saveTeamPlatform(actor, input.teamId, input.platform);
    } else {
      await saveDiscordRoleConnection(actor, roleConnectionSchema.parse(body));
    }
    return Response.json({ data: true }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const actor = await requireApiUser();
    const body = z
      .object({
        kind: z.enum(['team-platform', 'discord-role']),
        id: z.string().min(1),
      })
      .parse(await request.json());
    if (body.kind === 'team-platform') await removeTeamPlatform(actor, body.id);
    else await removeDiscordRoleConnection(actor, body.id);
    return Response.json({ data: true });
  } catch (error) {
    return apiError(error);
  }
}
