import 'server-only';
import { createSign } from 'node:crypto';
import { getGithubEnv } from '@/lib/env/server';

const githubApi = 'https://api.github.com';

function base64Url(value: string | Buffer) {
  return Buffer.from(value)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function createAppJwt() {
  const { appId, privateKey } = getGithubEnv();
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64Url(
    JSON.stringify({ iat: now - 60, exp: now + 540, iss: appId }),
  );
  const unsigned = `${header}.${payload}`;
  const signer = createSign('RSA-SHA256');
  signer.update(unsigned);
  signer.end();
  return `${unsigned}.${base64Url(signer.sign(privateKey.replace(/\\n/g, '\n')))}`;
}

async function githubRequest<T>(path: string, init: RequestInit = {}) {
  const response = await fetch(`${githubApi}${path}`, {
    ...init,
    headers: {
      accept: 'application/vnd.github+json',
      'x-github-api-version': '2022-11-28',
      ...init.headers,
    },
  });
  if (!response.ok)
    throw new Error(
      `GitHub API respondió ${response.status}: ${await response.text()}`,
    );
  return (await response.json()) as T;
}

export function getGithubInstallUrl(state: string) {
  const { appSlug } = getGithubEnv();
  const url = new URL(`https://github.com/apps/${appSlug}/installations/new`);
  url.searchParams.set('state', state);
  return url.toString();
}

export async function getGithubInstallation(installationId: string) {
  return githubRequest<{
    id: number;
    account: { login: string; type: string };
  }>(`/app/installations/${installationId}`, {
    headers: { authorization: `Bearer ${createAppJwt()}` },
  });
}

async function getInstallationToken(installationId: string) {
  const response = await githubRequest<{ token: string }>(
    `/app/installations/${installationId}/access_tokens`,
    {
      method: 'POST',
      headers: { authorization: `Bearer ${createAppJwt()}` },
    },
  );
  return response.token;
}

export async function listInstallationRepositories(installationId: string) {
  const token = await getInstallationToken(installationId);
  const repositories: Array<{
    id: number;
    name: string;
    full_name: string;
    html_url: string;
    default_branch: string | null;
    owner: { login: string };
  }> = [];
  for (let page = 1; page <= 10; page += 1) {
    const pageRepositories = await githubRequest<{
      repositories: typeof repositories;
    }>(`/installation/repositories?per_page=100&page=${page}`, {
      headers: { authorization: `Bearer ${token}` },
    });
    repositories.push(...pageRepositories.repositories);
    if (pageRepositories.repositories.length < 100) break;
  }
  return repositories;
}
