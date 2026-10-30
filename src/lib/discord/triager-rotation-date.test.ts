import { describe, expect, it } from 'vitest';
import {
  getMonday,
  getRotationIndex,
  isRotationReminderTime,
} from './triager-rotation-date';

describe('triager rotation schedule', () => {
  it('resolves the Monday for a Santiago local date', () => {
    expect(getMonday('2026-10-30')).toBe('2026-10-26');
  });

  it('advances one member each week and wraps around', () => {
    expect(getRotationIndex('2026-10-26', '2026-10-26', 3)).toBe(0);
    expect(getRotationIndex('2026-10-26', '2026-11-02', 3)).toBe(1);
    expect(getRotationIndex('2026-10-26', '2026-11-16', 3)).toBe(0);
  });

  it('does not start before its configured Monday', () => {
    expect(getRotationIndex('2026-11-02', '2026-10-26', 2)).toBe(-1);
  });

  it('recognizes the reminder time across Chilean daylight saving offsets', () => {
    expect(isRotationReminderTime(new Date('2026-10-26T12:30:00Z'))).toBe(true);
    expect(isRotationReminderTime(new Date('2026-10-26T12:35:00Z'))).toBe(true);
    expect(isRotationReminderTime(new Date('2026-07-06T13:30:00Z'))).toBe(true);
    expect(isRotationReminderTime(new Date('2026-10-26T12:29:00Z'))).toBe(
      false,
    );
    expect(isRotationReminderTime(new Date('2026-10-26T12:40:00Z'))).toBe(
      false,
    );
    expect(isRotationReminderTime(new Date('2026-10-27T12:30:00Z'))).toBe(
      false,
    );
  });
});
