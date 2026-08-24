import { describe, expect, it } from 'vitest';
import { ticketCode, ticketThreadName } from '@/lib/tickets/format';

describe('ticket format', () => {
  it('crea el código público desde el número correlativo', () => {
    expect(ticketCode({ id: 42 })).toBe('RTP-42');
  });

  it('crea un nombre de thread válido con código y título', () => {
    expect(ticketThreadName({ id: 42, title: 'Error\ncrítico' })).toBe(
      'RTP-42: Error crítico',
    );
    expect(ticketThreadName({ id: 42, title: 'a'.repeat(200) })).toHaveLength(
      100,
    );
  });
});
