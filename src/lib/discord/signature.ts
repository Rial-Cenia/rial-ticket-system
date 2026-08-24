import { verifyKey } from 'discord-interactions';

export function verifyDiscordRequest(
  rawBody: string,
  headers: Headers,
  publicKey: string,
) {
  const signature = headers.get('x-signature-ed25519');
  const timestamp = headers.get('x-signature-timestamp');
  if (!signature || !timestamp) return Promise.resolve(false);
  return verifyKey(rawBody, signature, timestamp, publicKey);
}
