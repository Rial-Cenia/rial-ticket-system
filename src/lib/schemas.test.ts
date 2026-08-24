import { describe, expect, it } from 'vitest';
import { createTicketSchema, updateTicketSchema } from '@/lib/schemas';

describe('ticket schemas', () => {
  it('aplica defaults al crear un ticket', () => {
    expect(
      createTicketSchema.parse({ title: 'Ayuda', description: 'Detalle' }),
    ).toEqual({
      title: 'Ayuda',
      description: 'Detalle',
      type: 'REQUERIMIENTO',
    });
  });

  it('rechaza parches vacíos y enums desconocidos', () => {
    expect(() => updateTicketSchema.parse({})).toThrow();
    expect(() => updateTicketSchema.parse({ status: 'CERRADO' })).toThrow();
  });
});
