import { describe, expect, test } from 'vitest';
import { createOAuthState, verifyOAuthState } from '@/lib/outlook/oauth-state';

describe('outlook oauth state', () => {
  test('verifies a state round trip before expiry', () => {
    const state = createOAuthState('state secret', 60_000, 1_000);

    expect(verifyOAuthState(state, 'state secret', 30_000)).toBe(true);
  });

  test('returns false after expiry', () => {
    const state = createOAuthState('state secret', 60_000, 1_000);

    expect(verifyOAuthState(state, 'state secret', 61_001)).toBe(false);
  });

  test('returns false for tampered state', () => {
    const state = createOAuthState('state secret', 60_000, 1_000);
    const [payload, signature] = state.split('.');
    const tamperedPayload = Buffer.from(
      JSON.stringify({ nonce: 'changed', expiresAt: 61_000 }),
      'utf8',
    ).toString('base64url');

    expect(verifyOAuthState(`${tamperedPayload}.${signature}`, 'state secret', 30_000)).toBe(false);
    expect(verifyOAuthState(`${payload}.tampered`, 'state secret', 30_000)).toBe(false);
  });

  test('returns false for malformed state', () => {
    expect(verifyOAuthState('', 'state secret', 1_000)).toBe(false);
    expect(verifyOAuthState('not-enough-parts', 'state secret', 1_000)).toBe(false);
    expect(verifyOAuthState('not-json.signature', 'state secret', 1_000)).toBe(false);
  });
});
