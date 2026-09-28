import { randomUUID } from 'node:crypto';
import { requireApiUser } from '@/lib/api/auth';
import { apiError } from '@/lib/http';
import { createGithubInstallUrl } from '@/lib/github/server';

export async function GET() {
  try {
    const actor = await requireApiUser();
    const state = randomUUID();
    const response = Response.json({
      data: { url: createGithubInstallUrl(actor, state) },
    });
    response.headers.append(
      'set-cookie',
      `github_install_state=${state}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`,
    );
    return response;
  } catch (error) {
    return apiError(error);
  }
}
