import { describe, expect, it } from 'vitest';
import { createHmac } from 'node:crypto';
import {
  parseKanbanCardCodes,
  verifyGithubSignature,
} from '@/lib/github/server';

describe('GitHub card code parsing', () => {
  it('detects multiple codes without case sensitivity', () => {
    expect(parseKanbanCardCodes('[abc-1] y [WEB2-42]')).toEqual([
      'ABC-1',
      'WEB2-42',
    ]);
  });

  it('ignores incomplete codes', () => {
    expect(parseKanbanCardCodes('[ABC] [A-1] [ABC-]')).toEqual([]);
  });
});

describe('GitHub webhook signature validation', () => {
  it('accepts a valid SHA-256 signature and rejects a forged one', () => {
    process.env.GITHUB_WEBHOOK_SECRET = 'test-secret';
    const payload = '{"action":"opened"}';
    const digest = createHmac('sha256', 'test-secret')
      .update(payload)
      .digest('hex');

    expect(verifyGithubSignature(payload, `sha256=${digest}`)).toBe(true);
    expect(verifyGithubSignature(payload, 'sha256=forged')).toBe(false);
  });
});
