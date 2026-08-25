import { describe, expect, it } from 'vitest';
import { canChangeTicketStatus, canTriage } from '@/lib/discord/authorization';

describe('Discord role authorization', () => {
  it('reserva triage al rol Barbilla Roja', () => {
    expect(canTriage(['triager'], 'triager')).toBe(true);
    expect(canTriage(['platform-1'], 'triager')).toBe(false);
  });

  it('permite cambiar estado a triage o a la plataforma asignada', () => {
    expect(canChangeTicketStatus(['triager'], 'triager', 'platform-1')).toBe(
      true,
    );
    expect(canChangeTicketStatus(['platform-1'], 'triager', 'platform-1')).toBe(
      true,
    );
    expect(canChangeTicketStatus(['platform-2'], 'triager', 'platform-1')).toBe(
      false,
    );
  });

  it('reserva los tickets externos al rol de triage', () => {
    expect(canChangeTicketStatus(['triager'], 'triager', null)).toBe(true);
    expect(canChangeTicketStatus(['platform-1'], 'triager', null)).toBe(false);
  });
});
