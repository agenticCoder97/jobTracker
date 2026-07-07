import { describe, expect, test, vi } from 'vitest';

vi.mock('@/lib/supabase/env', () => ({ shouldUseSupabaseAdapter: () => true }));
vi.mock('@/lib/repositories/supabase/research-repository', () => ({
  listExternalJobs: async () => [
    {
      sourceProvider: 'themuse',
      sourceId: '1',
      title: 'React Dev',
      companyName: 'Acme',
      tags: ['react'],
      raw: null,
    },
  ],
}));
vi.mock('@/lib/repositories/supabase/research-preferences-repository', () => ({
  getSearchPreferences: async () => ({ keywords: ['react'], location: '', remote: 'any' }),
}));

import { GET } from '@/app/api/jobs/listings/route';

describe('GET /api/jobs/listings', () => {
  test('returns mapped listings with match scores', async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.listings).toHaveLength(1);
    expect(body.listings[0]).toMatchObject({ company: 'acme', role: 'React Dev', match: 100 });
  });
});
