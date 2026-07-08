import 'server-only';

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

type OAuthStatePayload = {
  nonce: string;
  expiresAt: number;
};

function signPayload(encodedPayload: string, secret: string): string {
  return createHmac('sha256', secret).update(encodedPayload).digest('base64url');
}

export function createOAuthState(secret: string, ttlMs = 10 * 60 * 1000, now = Date.now()): string {
  const payload: OAuthStatePayload = {
    nonce: randomBytes(16).toString('base64url'),
    expiresAt: now + ttlMs,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');

  return `${encodedPayload}.${signPayload(encodedPayload, secret)}`;
}

export function verifyOAuthState(state: string, secret: string, now = Date.now()): boolean {
  try {
    const parts = state.split('.');
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      return false;
    }

    const [encodedPayload, signature] = parts;
    const expectedSignature = Buffer.from(signPayload(encodedPayload, secret), 'base64url');
    const receivedSignature = Buffer.from(signature, 'base64url');

    if (
      receivedSignature.length !== expectedSignature.length ||
      !timingSafeEqual(receivedSignature, expectedSignature)
    ) {
      return false;
    }

    const payload = JSON.parse(
      Buffer.from(encodedPayload, 'base64url').toString('utf8'),
    ) as Partial<OAuthStatePayload>;

    return typeof payload.expiresAt === 'number' && payload.expiresAt >= now;
  } catch {
    return false;
  }
}
