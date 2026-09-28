import { cookies } from 'next/headers';
import { getAuthenticatedUser } from '@/lib/auth';
import { getServerEnv } from '@/lib/env/server';
import { HttpError, apiError } from '@/lib/http';
import { syncGithubInstallation } from '@/lib/github/server';

export async function GET(request: Request) {
  try {
    const actor = await getAuthenticatedUser();
    if (!actor) throw new HttpError('No autenticado', 401);
    const url = new URL(request.url);
    const installationId = url.searchParams.get('installation_id');
    const state = url.searchParams.get('state');
    const expectedState = (await cookies()).get('github_install_state')?.value;
    if (!installationId || !state || !expectedState || state !== expectedState)
      throw new HttpError('La instalación de GitHub no pudo validarse', 400);
    await syncGithubInstallation(actor, installationId);
    return Response.redirect(
      new URL('/settings?github=connected', getServerEnv().APP_URL),
    );
  } catch (error) {
    return apiError(error);
  }
}
