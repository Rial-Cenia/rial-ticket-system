import { describe, expect, it } from 'vitest';
import {
  canAnalyzeWithCodex,
  canImplementWithCodex,
  canRespondToCodex,
} from '@/lib/codex/authorization';

describe('Codex authorization', () => {
  it('reserves analysis and implementation for Codex Operators', () => {
    expect(canAnalyzeWithCodex(['operator'], 'operator')).toBe(true);
    expect(canImplementWithCodex(['operator'], 'operator')).toBe(true);
    expect(canAnalyzeWithCodex(['triager'], 'operator')).toBe(false);
    expect(canImplementWithCodex(['triager'], 'operator')).toBe(false);
  });

  it('limits replies to authorized Discord users', () => {
    expect(canRespondToCodex('creator', ['creator', 'operator'])).toBe(true);
    expect(canRespondToCodex('random-user', ['creator', 'operator'])).toBe(
      false,
    );
  });
});
