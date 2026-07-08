import { afterEach, describe, expect, test, vi } from 'vitest';
import { getOutlookConfig } from '@/lib/outlook/config';

const outlookEnvKeys = [
  'MICROSOFT_CLIENT_ID',
  'MICROSOFT_CLIENT_SECRET',
  'MICROSOFT_TENANT',
  'MICROSOFT_REDIRECT_URI',
  'OUTLOOK_TOKEN_ENCRYPTION_KEY',
  'OUTLOOK_SCAN_SIGNING_SECRET',
] as const;

function clearOutlookEnv() {
  for (const key of outlookEnvKeys) {
    vi.stubEnv(key, undefined);
  }
}

describe('getOutlookConfig', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test('reads complete config with the expected scopes', () => {
    clearOutlookEnv();
    vi.stubEnv('MICROSOFT_CLIENT_ID', 'client-id');
    vi.stubEnv('MICROSOFT_CLIENT_SECRET', 'client-secret');
    vi.stubEnv('MICROSOFT_TENANT', 'tenant-id');
    vi.stubEnv('MICROSOFT_REDIRECT_URI', 'https://app.example/api/outlook/callback');
    vi.stubEnv('OUTLOOK_TOKEN_ENCRYPTION_KEY', 'token-key');
    vi.stubEnv('OUTLOOK_SCAN_SIGNING_SECRET', 'scan-secret');

    expect(getOutlookConfig()).toEqual({
      clientId: 'client-id',
      clientSecret: 'client-secret',
      tenant: 'tenant-id',
      redirectUri: 'https://app.example/api/outlook/callback',
      tokenEncryptionKey: 'token-key',
      scanSigningSecret: 'scan-secret',
      scopes: ['openid', 'profile', 'offline_access', 'Mail.Read'],
    });
  });

  test('defaults the tenant to common when unset', () => {
    clearOutlookEnv();
    vi.stubEnv('MICROSOFT_CLIENT_ID', 'client-id');
    vi.stubEnv('MICROSOFT_CLIENT_SECRET', 'client-secret');
    vi.stubEnv('MICROSOFT_REDIRECT_URI', 'https://app.example/api/outlook/callback');
    vi.stubEnv('OUTLOOK_TOKEN_ENCRYPTION_KEY', 'token-key');
    vi.stubEnv('OUTLOOK_SCAN_SIGNING_SECRET', 'scan-secret');

    expect(getOutlookConfig().tenant).toBe('common');
  });

  test('throws with all missing required env variable names', () => {
    clearOutlookEnv();
    vi.stubEnv('MICROSOFT_CLIENT_ID', 'client-id');

    expect(() => getOutlookConfig()).toThrow(/MICROSOFT_CLIENT_SECRET/);
    expect(() => getOutlookConfig()).toThrow(/MICROSOFT_REDIRECT_URI/);
    expect(() => getOutlookConfig()).toThrow(/OUTLOOK_TOKEN_ENCRYPTION_KEY/);
    expect(() => getOutlookConfig()).toThrow(/OUTLOOK_SCAN_SIGNING_SECRET/);
  });
});
