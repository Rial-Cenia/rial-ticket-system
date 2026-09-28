import { processGithubWebhook } from '@/lib/github/server';

export async function POST(request: Request) {
  try {
    const result = await processGithubWebhook(
      await request.text(),
      request.headers.get('x-hub-signature-256'),
      request.headers.get('x-github-delivery'),
      request.headers.get('x-github-event'),
    );
    return Response.json({ data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Webhook inválido';
    const status = message.includes('Firma') ? 401 : 400;
    return Response.json({ error: message }, { status });
  }
}
