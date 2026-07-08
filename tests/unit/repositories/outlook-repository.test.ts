import { beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('@/lib/server/owner', () => ({ getOwnerUserId: () => 'owner-1' }));

const upsertMock = vi.fn().mockResolvedValue({ error: null });
const maybeSingleMock = vi.fn();
const selectEqSpy = vi.fn();

// Result the awaited `.select().eq()` chain resolves to (used by list reads).
let eqResult: { data: unknown; error: unknown } = { data: [], error: null };

vi.mock('@/lib/supabase/admin', () => ({
  getSupabaseAdminClient: () => ({
    from: (table: string) => ({
      upsert: (rows: unknown, opts?: unknown) => upsertMock(table, rows, opts),
      select: (columns: string) => ({
        eq: (col: string, val: string) => {
          selectEqSpy(table, columns, col, val);
          // Awaitable (list reads) AND exposes maybeSingle (single-row reads).
          return {
            maybeSingle: () => maybeSingleMock(table),
            then: (
              resolve: (value: unknown) => unknown,
              reject: (reason: unknown) => unknown,
            ) => Promise.resolve(eqResult).then(resolve, reject),
          };
        },
      }),
    }),
  }),
}));

import {
  getOutlookConnection,
  listImportedMessageIds,
  recordImportedMessages,
  saveOutlookConnection,
} from '@/lib/repositories/supabase/outlook-repository';

describe('outlook repository', () => {
  beforeEach(() => {
    upsertMock.mockClear();
    maybeSingleMock.mockReset();
    selectEqSpy.mockReset();
    eqResult = { data: [], error: null };
  });

  test('saves encrypted connection pinned to owner', async () => {
    await saveOutlookConnection({
      email: 'me@example.com',
      refreshTokenCiphertext: 'cipher',
      refreshTokenIv: 'iv',
      refreshTokenTag: 'tag',
      scope: 'Mail.Read',
    });

    expect(upsertMock).toHaveBeenCalledWith(
      'outlook_connections',
      expect.objectContaining({
        owner_user_id: 'owner-1',
        email: 'me@example.com',
        refresh_token_ciphertext: 'cipher',
        refresh_token_iv: 'iv',
        refresh_token_tag: 'tag',
        scope: 'Mail.Read',
      }),
      { onConflict: 'owner_user_id' },
    );
  });

  test('getOutlookConnection returns null when no row exists', async () => {
    maybeSingleMock.mockResolvedValue({ data: null, error: null });

    await expect(getOutlookConnection()).resolves.toBeNull();
    expect(selectEqSpy).toHaveBeenCalledWith(
      'outlook_connections',
      expect.stringContaining('refresh_token_ciphertext'),
      'owner_user_id',
      'owner-1',
    );
  });

  test('getOutlookConnection maps a stored row', async () => {
    maybeSingleMock.mockResolvedValue({
      data: {
        email: 'me@example.com',
        refresh_token_ciphertext: 'cipher',
        refresh_token_iv: 'iv',
        refresh_token_tag: 'tag',
        scope: 'Mail.Read',
      },
      error: null,
    });

    await expect(getOutlookConnection()).resolves.toEqual({
      email: 'me@example.com',
      refreshTokenCiphertext: 'cipher',
      refreshTokenIv: 'iv',
      refreshTokenTag: 'tag',
      scope: 'Mail.Read',
    });
  });

  test('listImportedMessageIds returns both message_id and internet_message_id', async () => {
    eqResult = {
      data: [
        { message_id: 'm-1', internet_message_id: '<i-1@example.com>' },
        { message_id: 'm-2', internet_message_id: null },
      ],
      error: null,
    };

    const ids = await listImportedMessageIds();

    expect(ids.has('m-1')).toBe(true);
    expect(ids.has('<i-1@example.com>')).toBe(true);
    expect(ids.has('m-2')).toBe(true);
    expect(ids.size).toBe(3);
  });

  test('recordImportedMessages upserts rows pinned to owner', async () => {
    await recordImportedMessages([
      {
        messageId: 'm-1',
        internetMessageId: '<i-1@example.com>',
        applicationId: 'app-1',
        companyName: 'Acme',
        role: 'Staff Engineer',
        receivedAt: '2026-07-07T00:00:00.000Z',
      },
    ]);

    expect(upsertMock).toHaveBeenCalledWith(
      'outlook_imported_messages',
      expect.arrayContaining([
        expect.objectContaining({
          owner_user_id: 'owner-1',
          message_id: 'm-1',
          internet_message_id: '<i-1@example.com>',
          application_id: 'app-1',
          role: 'Staff Engineer',
        }),
      ]),
      { onConflict: 'owner_user_id,message_id' },
    );
  });

  test('recordImportedMessages skips empty input', async () => {
    await recordImportedMessages([]);
    expect(upsertMock).not.toHaveBeenCalled();
  });
});
