export async function apiRequest<T>(
  url: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { 'content-type': 'application/json', ...init?.headers },
  });
  const body = (await response.json()) as { data?: T; error?: string };
  if (!response.ok || body.data === undefined)
    throw new Error(body.error ?? 'La solicitud falló');
  return body.data;
}

export async function formDataRequest<T>(
  url: string,
  method: 'POST' | 'PATCH',
  body: FormData,
): Promise<T> {
  const response = await fetch(url, { method, body });
  const responseBody = (await response.json()) as { data?: T; error?: string };
  if (!response.ok || responseBody.data === undefined)
    throw new Error(responseBody.error ?? 'La solicitud falló');
  return responseBody.data;
}
