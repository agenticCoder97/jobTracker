import { describe, expect, test, vi } from 'vitest';

vi.mock('@/lib/outlook/config', () => ({
  getOutlookConfig: () => ({
    clientId: 'client',
    clientSecret: 'secret',
    tenant: 'common',
    redirectUri: 'http://localhost/callback',
    tokenEncryptionKey: 'abcdefghijklmnopqrstuvwxyz123456',
    scanSigningSecret: 'signing-secret',
    scopes: ['openid', 'profile', 'offline_access', 'Mail.Read'],
  }),
}));
vi.mock('@/lib/repositories/supabase/outlook-repository', () => ({
  getOutlookConnection: vi.fn(async () => ({
    email: 'me@example.com',
    refreshTokenCiphertext: 'cipher',
    refreshTokenIv: 'iv',
    refreshTokenTag: 'tag',
    scope: 'Mail.Read',
  })),
  listImportedMessageIds: vi.fn(async () => new Set(['already-imported'])),
}));
vi.mock('@/lib/outlook/crypto', () => ({ decryptToken: () => 'refresh-token' }));
vi.mock('@/lib/outlook/oauth', () => ({
  refreshAccessToken: vi.fn(async () => ({
    accessToken: 'access-token',
    refreshToken: 'refresh-token-2',
    scope: 'Mail.Read',
    expiresIn: 3600,
  })),
}));
vi.mock('@/lib/outlook/graph', () => ({
  listRecentInboxMessages: vi.fn(async () => [
    {
      id: 'message-1',
      subject: 'Thank you for applying to Staff Engineer at Acme',
      receivedDateTime: '2026-07-07T00:00:00.000Z',
      from: { emailAddress: { name: 'Acme Recruiting', address: 'no-reply@greenhouse.io' } },
      bodyPreview: 'We received your application.',
    },
    {
      id: 'already-imported',
      subject: 'Thank you for applying to Old Role at Acme',
      receivedDateTime: '2026-07-07T00:00:00.000Z',
      from: { emailAddress: { name: 'Acme Recruiting', address: 'no-reply@greenhouse.io' } },
      bodyPreview: 'We received your application.',
    },
  ]),
}));

describe('scanOutlookApplications', () => {
  test('returns signed candidates excluding already imported messages', async () => {
    const { scanOutlookApplications } = await import('@/lib/outlook/scan');

    const result = await scanOutlookApplications();

    expect(result.connectedEmail).toBe('me@example.com');
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]!.payload.messageId).toBe('message-1');
    expect(result.candidates[0]!.signature).toBeTruthy();
  });
});
