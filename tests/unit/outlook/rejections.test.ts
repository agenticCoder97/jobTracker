import { beforeEach, describe, expect, test, vi } from 'vitest';

import type { Application } from '@/lib/types';

vi.mock('@/lib/outlook/config', () => ({
  getOutlookConfig: () => ({ tokenEncryptionKey: 'key' }),
}));
vi.mock('@/lib/outlook/crypto', () => ({ decryptToken: () => 'refresh-token' }));
vi.mock('@/lib/outlook/oauth', () => ({
  refreshAccessToken: vi.fn(async () => ({ accessToken: 'access-token' })),
}));

const listInboxMessages = vi.fn<(token: unknown, query: unknown) => Promise<unknown>>();
vi.mock('@/lib/outlook/graph', () => ({
  listInboxMessages: (token: unknown, query: unknown) => listInboxMessages(token, query),
}));

const getOutlookConnection = vi.fn<() => Promise<unknown>>();
const listImportedMessageIds = vi.fn<() => Promise<Set<string>>>();
const recordImportedMessages = vi.fn<(rows: unknown) => Promise<void>>(async () => undefined);
vi.mock('@/lib/repositories/supabase/outlook-repository', () => ({
  getOutlookConnection: () => getOutlookConnection(),
  listImportedMessageIds: () => listImportedMessageIds(),
  recordImportedMessages: (rows: unknown) => recordImportedMessages(rows),
}));

const listAppsState = vi.fn<() => Promise<unknown>>();
const upsertBundles = vi.fn<(bundles: unknown) => Promise<void>>(async () => undefined);
vi.mock('@/lib/repositories/supabase/apps-repository', () => ({
  listAppsState: () => listAppsState(),
  upsertBundles: (bundles: unknown) => upsertBundles(bundles),
}));

function visaApplication(status: Application['status'] = 'applied'): Application {
  return {
    id: 'visa-app',
    ownerUserId: 'owner',
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
    deletedAt: null,
    displayId: 'JT-1',
    status,
    company: 'visa',
    companyName: 'Visa',
    role: 'Staff Software Engineer',
    location: 'Remote',
    remote: 'Remote',
    salaryMin: 0,
    salaryMax: 0,
    level: 'Staff',
    team: 'Product',
    posted: '2026-07-01',
    applied: '2026-07-01',
    lastActivity: '2026-07-01T00:00:00.000Z',
    priority: 'high',
    source: 'Manual entry',
    progress: 20,
    tags: [],
    sourceListingId: null,
    sortIndex: 0,
    archivedAt: null,
  };
}

const rejectionMessage = {
  id: 'rejection-message',
  internetMessageId: '<rejection@example.com>',
  subject: 'Visa - Application Update',
  receivedDateTime: '2026-07-10T17:03:02.000Z',
  from: { emailAddress: { name: 'Visa People Team', address: 'visa@myworkday.com' } },
  bodyPreview:
    'Thank you for taking the time to apply for the Staff Software Engineer position at 810 Visa Technology and Operations LLC. We are unable to move forward with your application.',
};

describe('processOutlookRejections', () => {
  beforeEach(() => {
    getOutlookConnection.mockResolvedValue({
      refreshTokenCiphertext: 'cipher',
      refreshTokenIv: 'iv',
      refreshTokenTag: 'tag',
    });
    listInboxMessages.mockResolvedValue([rejectionMessage]);
    listImportedMessageIds.mockResolvedValue(new Set());
    listAppsState.mockResolvedValue({
      applications: [visaApplication()],
      activity: {
        'visa-app': { comments: [], history: [], links: [], attachments: [] },
      },
      appDocs: {},
    });
    upsertBundles.mockClear();
    recordImportedMessages.mockClear();
  });

  test('moves a matched application to rejected and records the message', async () => {
    const { processOutlookRejections } = await import('@/lib/outlook/rejections');

    const result = await processOutlookRejections(new Date('2026-07-15T00:00:00.000Z'));

    expect(result.updated).toBe(1);
    expect(upsertBundles).toHaveBeenCalledWith([
      expect.objectContaining({
        application: expect.objectContaining({
          id: 'visa-app',
          status: 'rejected',
          rejectedReason: expect.stringContaining('unable to move forward'),
        }),
        activity: expect.objectContaining({
          history: expect.arrayContaining([
            expect.objectContaining({ type: 'status', text: expect.stringContaining('Outlook') }),
          ]),
        }),
      }),
    ]);
    expect(recordImportedMessages).toHaveBeenCalledWith([
      expect.objectContaining({
        messageId: 'rejection-message',
        applicationId: 'visa-app',
      }),
    ]);
    expect(listInboxMessages).toHaveBeenCalledWith(
      'access-token',
      expect.objectContaining({ lookbackDays: 14, maxMessages: 200 }),
    );
  });

  test('records but does not rewrite an application that is already rejected', async () => {
    listAppsState.mockResolvedValue({
      applications: [visaApplication('rejected')],
      activity: {
        'visa-app': { comments: [], history: [], links: [], attachments: [] },
      },
      appDocs: {},
    });
    const { processOutlookRejections } = await import('@/lib/outlook/rejections');

    const result = await processOutlookRejections();

    expect(result.alreadyRejected).toBe(1);
    expect(upsertBundles).not.toHaveBeenCalled();
    expect(recordImportedMessages).toHaveBeenCalledTimes(1);
  });

  test('skips messages already processed by a prior run', async () => {
    listImportedMessageIds.mockResolvedValue(new Set(['rejection-message']));
    const { processOutlookRejections } = await import('@/lib/outlook/rejections');

    const result = await processOutlookRejections();

    expect(result.unprocessed).toBe(0);
    expect(upsertBundles).not.toHaveBeenCalled();
    expect(recordImportedMessages).not.toHaveBeenCalled();
  });
});
