import { describe, expect, test, vi } from 'vitest';
import { signImportCandidate, type UnsignedImportCandidate } from '@/lib/outlook/candidate-signing';

vi.mock('@/lib/outlook/config', () => ({
  getOutlookConfig: () => ({
    clientId: 'client',
    clientSecret: 'secret',
    tenant: 'common',
    redirectUri: 'http://localhost/callback',
    tokenEncryptionKey: 'encrypt',
    scanSigningSecret: 'secret',
    scopes: ['openid', 'profile', 'offline_access', 'Mail.Read'],
  }),
}));

const upsertBundles = vi.fn(async () => undefined);
const recordImportedMessages = vi.fn(async () => undefined);
vi.mock('@/lib/repositories/supabase/apps-repository', () => ({ upsertBundles }));
vi.mock('@/lib/repositories/supabase/outlook-repository', () => ({ recordImportedMessages }));

const candidate: UnsignedImportCandidate = {
  messageId: 'message-1',
  subject: 'Thank you for applying to Staff Engineer at Acme',
  fromName: 'Acme',
  fromAddress: 'no-reply@greenhouse.io',
  receivedAt: '2026-07-07T12:00:00.000Z',
  bodyPreview: 'We received your application.',
  confidence: 'high',
  score: 90,
  reasons: ['application confirmation phrase'],
  extracted: {
    companyName: 'Acme',
    role: 'Staff Engineer',
    source: 'Outlook',
    applied: '2026-07-07',
  },
};

describe('importOutlookCandidates', () => {
  test('verifies signed candidates, creates bundles, records imports', async () => {
    const { importOutlookCandidates } = await import('@/lib/outlook/import');
    const result = await importOutlookCandidates([signImportCandidate(candidate, 'secret')]);

    expect(result.imported).toHaveLength(1);
    expect(upsertBundles).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          application: expect.objectContaining({ role: 'Staff Engineer' }),
        }),
      ]),
    );
    expect(recordImportedMessages).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ messageId: 'message-1', role: 'Staff Engineer' }),
      ]),
    );
  });
});
