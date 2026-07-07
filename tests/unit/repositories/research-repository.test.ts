import { beforeEach, describe, expect, test, vi } from 'vitest';

const upsert = vi.fn().mockResolvedValue({ error: null });
const from = vi.fn(() => ({ upsert }));
vi.mock('@/lib/supabase/admin', () => ({
  getSupabaseAdminClient: () => ({ from }),
}));
vi.mock('@/lib/server/owner', () => ({ getOwnerUserId: () => 'owner-1' }));

import { upsertExternalJobs } from '@/lib/repositories/supabase/research-repository';
import type { ExternalJob } from '@/lib/api/types';

const job: ExternalJob = {
  sourceProvider: 'themuse',
  sourceId: '42',
  title: 'Engineer',
  companyName: 'Acme',
  raw: { any: 'thing' },
};

describe('upsertExternalJobs', () => {
  beforeEach(() => {
    upsert.mockClear();
    from.mockClear();
  });

  test('writes payload row keyed on (source_provider, source_id)', async () => {
    await upsertExternalJobs([job]);
    expect(from).toHaveBeenCalledWith('external_jobs');
    const [rows, opts] = upsert.mock.calls[0]!;
    expect(opts).toEqual({ onConflict: 'source_provider,source_id' });
    expect(rows[0]).toMatchObject({
      source_provider: 'themuse',
      source_id: '42',
      payload: job,
    });
    expect(typeof rows[0].fetched_at).toBe('string');
  });

  test('no-op on an empty array', async () => {
    await upsertExternalJobs([]);
    expect(upsert).not.toHaveBeenCalled();
  });
});
