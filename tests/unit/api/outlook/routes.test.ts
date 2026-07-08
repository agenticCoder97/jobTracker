import { describe, expect, test, vi } from 'vitest';

vi.mock('@/lib/repositories/supabase/outlook-repository', () => ({
  getOutlookConnection: vi.fn(async () => null),
}));
vi.mock('@/lib/outlook/scan', () => ({
  scanOutlookApplications: vi.fn(async () => ({ connectedEmail: null, candidates: [] })),
}));
vi.mock('@/lib/outlook/import', () => ({
  importOutlookCandidates: vi.fn(async () => ({ imported: [] })),
}));

import * as importRoute from '@/app/api/outlook/import/route';
import * as scan from '@/app/api/outlook/scan/route';
import * as status from '@/app/api/outlook/status/route';

describe('outlook api routes', () => {
  test('status reports disconnected when no connection exists', async () => {
    const res = await status.GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ connected: false, email: null });
  });

  test('scan returns the scan result shape', async () => {
    const res = await scan.POST();
    expect(await res.json()).toMatchObject({ candidates: [] });
  });

  test('import validates body and returns imported result', async () => {
    const res = await importRoute.POST(
      new Request('http://test', { method: 'POST', body: JSON.stringify({ candidates: [] }) }),
    );
    expect(await res.json()).toEqual({ imported: [] });
  });

  test('import rejects a malformed body', async () => {
    const res = await importRoute.POST(
      new Request('http://test', { method: 'POST', body: 'not-json' }),
    );
    expect(res.status).toBe(400);
  });
});
