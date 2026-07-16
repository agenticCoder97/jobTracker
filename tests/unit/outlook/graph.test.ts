import { describe, expect, test, vi } from 'vitest';
import { listInboxMessages, listRecentInboxMessages } from '@/lib/outlook/graph';

describe('outlook graph client', () => {
  test('queries recent inbox messages with bounded select', async () => {
    const fetchMock = vi.fn(async (..._args: unknown[]) =>
      Response.json({ value: [{ id: '1', receivedDateTime: '2026-07-07T00:00:00.000Z' }] }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const messages = await listRecentInboxMessages('token', new Date('2026-07-07T00:00:00.000Z'));

    const url = new URL(String(fetchMock.mock.calls[0]![0]));
    expect(url.pathname).toBe('/v1.0/me/mailFolders/inbox/messages');
    expect(url.searchParams.get('$top')).toBe('50');
    expect(url.searchParams.get('$select')).toContain('bodyPreview');
    expect(url.searchParams.get('$filter')).toContain('2026-07-04T00:00:00.000Z');
    expect(messages).toHaveLength(1);
  });

  test('supports a wider bounded cron lookback', async () => {
    const fetchMock = vi.fn(async (..._args: unknown[]) => Response.json({ value: [] }));
    vi.stubGlobal('fetch', fetchMock);

    await listInboxMessages('token', {
      now: new Date('2026-07-15T00:00:00.000Z'),
      lookbackDays: 14,
      maxMessages: 200,
    });

    const url = new URL(String(fetchMock.mock.calls[0]![0]));
    expect(url.searchParams.get('$top')).toBe('200');
    expect(url.searchParams.get('$filter')).toContain('2026-07-01T00:00:00.000Z');
  });
});
