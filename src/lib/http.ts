import { ZodError } from 'zod';

export function apiError(error: unknown) {
  if (error instanceof ZodError) {
    return Response.json(
      { error: 'Solicitud inválida', issues: error.issues },
      { status: 400 },
    );
  }

  const message = error instanceof Error ? error.message : 'Error inesperado';
  const status = message === 'Ticket not found' ? 404 : 500;
  return Response.json({ error: message }, { status });
}
