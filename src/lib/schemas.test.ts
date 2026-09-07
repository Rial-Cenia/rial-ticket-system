import { describe, expect, it } from 'vitest';
import {
  createKanbanCardSchema,
  createKanbanSchema,
  createTicketSchema,
  discordRoleUpdateSchema,
  updateTicketSchema,
} from '@/lib/schemas';

describe('ticket schemas', () => {
  it('aplica defaults al crear un ticket', () => {
    expect(
      createTicketSchema.parse({ title: 'Ayuda', description: 'Detalle' }),
    ).toEqual({
      title: 'Ayuda',
      description: 'Detalle',
      type: 'REQUERIMIENTO',
      priority: 'MEDIA',
    });
  });

  it('rechaza parches vacíos y enums desconocidos', () => {
    expect(() => updateTicketSchema.parse({})).toThrow();
    expect(() => updateTicketSchema.parse({ status: 'CERRADO' })).toThrow();
  });

  it('acepta el estado de staging', () => {
    expect(updateTicketSchema.parse({ status: 'EN_STAGING' })).toEqual({
      status: 'EN_STAGING',
    });
  });

  it('valida los cuatro niveles de prioridad', () => {
    for (const priority of ['BAJA', 'MEDIA', 'ALTA', 'CRITICA']) {
      expect(updateTicketSchema.parse({ priority })).toEqual({ priority });
    }
    expect(() => updateTicketSchema.parse({ priority: 'URGENTE' })).toThrow();
  });

  it('acepta tickets externos a las plataformas internas', () => {
    expect(updateTicketSchema.parse({ platform: 'EXTERNO' })).toEqual({
      platform: 'EXTERNO',
    });
  });

  it('acepta únicamente booleanos al cambiar el rol de Discord', () => {
    expect(discordRoleUpdateSchema.parse({ enabled: true })).toEqual({
      enabled: true,
    });
    expect(() => discordRoleUpdateSchema.parse({ enabled: 'true' })).toThrow();
  });
});

describe('kanban schemas', () => {
  it('exige al menos un equipo al crear un kanban', () => {
    expect(() =>
      createKanbanSchema.parse({ name: 'Producto', teamIds: [] }),
    ).toThrow();
  });

  it('permite descripciones sin límite artificial y aplica prioridad media', () => {
    const description = 'contenido '.repeat(2000);
    expect(
      createKanbanCardSchema.parse({
        title: 'Documentar lanzamiento',
        description,
        stateId: '10000000-0000-4000-8000-000000000001',
      }),
    ).toEqual({
      title: 'Documentar lanzamiento',
      description,
      stateId: '10000000-0000-4000-8000-000000000001',
      priority: 'MEDIA',
      tagIds: [],
    });
  });
});
