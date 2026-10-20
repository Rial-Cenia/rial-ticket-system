import { describe, expect, it } from 'vitest';
import {
  calculateCodexUsageCost,
  formatCodexUsageCost,
} from '@/lib/codex/cost';

describe('Codex usage cost', () => {
  it('calculates the implementation and analysis cost from recorded usage', () => {
    const cost = calculateCodexUsageCost([
      {
        phase: 'ANALYSIS',
        inputTokens: 2205,
        cachedInputTokens: 0,
        outputTokens: 1360,
      },
      {
        phase: 'IMPLEMENTATION',
        inputTokens: 507463,
        cachedInputTokens: 467456,
        outputTokens: 5797,
      },
    ]);

    expect(cost).toBeCloseTo(0.2362, 4);
    expect(formatCodexUsageCost(cost)).toBe('US$0.24');
  });

  it('ignores usage from unknown phases', () => {
    expect(
      calculateCodexUsageCost([
        {
          phase: 'UNKNOWN',
          inputTokens: 1_000_000,
          cachedInputTokens: 0,
          outputTokens: 1_000_000,
        },
      ]),
    ).toBe(0);
  });
});
