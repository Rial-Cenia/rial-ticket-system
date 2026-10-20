const TOKENS_PER_MILLION = 1_000_000;

const RATES_BY_PHASE = {
  ANALYSIS: {
    input: 0.25,
    cachedInput: 0.025,
    output: 2,
  },
  PREFLIGHT: {
    input: 1.75,
    cachedInput: 0.175,
    output: 14,
  },
  IMPLEMENTATION: {
    input: 1.75,
    cachedInput: 0.175,
    output: 14,
  },
  RETRY: {
    input: 1.75,
    cachedInput: 0.175,
    output: 14,
  },
} as const;

export interface CodexUsageForCost {
  phase: string;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
}

export function calculateCodexUsageCost(usages: CodexUsageForCost[]) {
  return usages.reduce((total, usage) => {
    const rates = RATES_BY_PHASE[usage.phase as keyof typeof RATES_BY_PHASE];
    if (!rates) return total;

    const uncachedInputTokens = Math.max(
      usage.inputTokens - usage.cachedInputTokens,
      0,
    );
    return (
      total +
      (uncachedInputTokens * rates.input +
        usage.cachedInputTokens * rates.cachedInput +
        usage.outputTokens * rates.output) /
        TOKENS_PER_MILLION
    );
  }, 0);
}

export function formatCodexUsageCost(cost: number) {
  return `US$${cost.toFixed(2)}`;
}
