import { describe, expect, test } from 'vitest';
import { decryptToken, encryptToken } from '@/lib/outlook/crypto';

describe('outlook token crypto', () => {
  test('encrypts and decrypts a token round trip', () => {
    const encrypted = encryptToken('refresh-token-value', 'encryption secret');

    expect(decryptToken(encrypted, 'encryption secret')).toBe('refresh-token-value');
  });

  test('does not expose plaintext and includes gcm metadata', () => {
    const encrypted = encryptToken('refresh-token-value', 'encryption secret');

    expect(encrypted.ciphertext).not.toContain('refresh-token-value');
    expect(encrypted.iv).toEqual(expect.any(String));
    expect(encrypted.tag).toEqual(expect.any(String));
    expect(encrypted.iv).not.toHaveLength(0);
    expect(encrypted.tag).not.toHaveLength(0);
  });
});
