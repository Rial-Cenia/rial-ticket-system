// @vitest-environment node
import { generateKeyPairSync, sign } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { verifyDiscordRequest } from '@/lib/discord/signature';

describe('Discord Ed25519 signature', () => {
  it('acepta el body exacto y rechaza un body alterado', async () => {
    const { privateKey, publicKey } = generateKeyPairSync('ed25519');
    const rawPublicKey = publicKey
      .export({ type: 'spki', format: 'der' })
      .subarray(-32)
      .toString('hex');
    const timestamp = '1724500000';
    const body = '{"type":1}';
    const signature = sign(
      null,
      Buffer.from(timestamp + body),
      privateKey,
    ).toString('hex');
    const headers = new Headers({
      'x-signature-ed25519': signature,
      'x-signature-timestamp': timestamp,
    });
    await expect(
      verifyDiscordRequest(body, headers, rawPublicKey),
    ).resolves.toBe(true);
    await expect(
      verifyDiscordRequest('{"type":2}', headers, rawPublicKey),
    ).resolves.toBe(false);
  });

  it('rechaza headers de firma ausentes', async () => {
    await expect(
      verifyDiscordRequest('{"type":1}', new Headers(), '00'.repeat(32)),
    ).resolves.toBe(false);
  });
});
