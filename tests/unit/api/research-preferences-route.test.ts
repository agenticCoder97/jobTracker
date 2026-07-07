import { describe, expect, test, vi } from 'vitest';

vi.mock('@/lib/supabase/env', () => ({ shouldUseSupabaseAdapter: () => true }));
const setSearchPreferences = vi.fn(async (p) => ({ keywords: ['react'], location: '', remote: 'any', ...p }));
vi.mock('@/lib/repositories/supabase/research-preferences-repository', () => ({
  getSearchPreferences: async () => ({ keywords: [], location: '', remote: 'any' }),
  setSearchPreferences: (p: unknown) => setSearchPreferences(p),
}));

import { PUT } from '@/app/api/research/preferences/route';

describe('PUT /api/research/preferences', () => {
  test('validates + persists preferences', async () => {
    const req = new Request('http://test/api/research/preferences', {
      method: 'PUT',
      body: JSON.stringify({ keywords: ['react'], location: 'NYC', remote: 'remote' }),
    });
    const res = await PUT(req);
    expect(res.status).toBe(200);
    expect(setSearchPreferences).toHaveBeenCalled();
  });

  test('rejects a malformed body', async () => {
    const req = new Request('http://test/api/research/preferences', {
      method: 'PUT',
      body: JSON.stringify({ remote: 123 }),
    });
    const res = await PUT(req);
    expect(res.status).toBe(400);
  });
});
