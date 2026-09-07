import { ZodError } from 'zod';

export class HttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export function apiError(error: unknown) {
  if (error instanceof ZodError) {
    return Response.json(
      { error: 'Solicitud inválida', issues: error.issues },
      { status: 400 },
    );
  }

  if (error instanceof HttpError)
    return Response.json({ error: error.message }, { status: error.status });

  const message = error instanceof Error ? error.message : 'Error inesperado';
  const status = message === 'Ticket not found' ? 404 : 500;
  return Response.json({ error: message }, { status });
}
