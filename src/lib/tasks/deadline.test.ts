import { describe, expect, it } from 'vitest';
import { isFirstDeliveryDueSoon } from '@/lib/tasks/deadline';

describe('isFirstDeliveryDueSoon', () => {
  const now = new Date(2026, 9, 27, 15);

  it('marca vencimientos de hoy y mañana', () => {
    expect(isFirstDeliveryDueSoon('2026-10-27', now)).toBe(true);
    expect(isFirstDeliveryDueSoon('2026-10-28', now)).toBe(true);
  });

  it('marca vencimientos atrasados y deja normales los de dos días o más', () => {
    expect(isFirstDeliveryDueSoon('2026-10-26', now)).toBe(true);
    expect(isFirstDeliveryDueSoon('2026-10-29', now)).toBe(false);
    expect(isFirstDeliveryDueSoon(null, now)).toBe(false);
  });
});
