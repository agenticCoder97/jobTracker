import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { ExternalJob, JobProvider } from '@/lib/api/types';

const okProvider: JobProvider = {
  id: 'themuse',
  kind: 'jobs',
  async searchJobs() {
    const jobs: ExternalJob[] = [
      { sourceProvider: 'themuse', sourceId: 'a', title: 'React Engineer', companyName: 'Acme', tags: ['react'], raw: null },
    ];
    return { jobs, report: { providerId: 'themuse', requestPath: '/jobs', httpStatus: 200, latencyMs: 5 } };
  },
};
const emptyProvider: JobProvider = {
  id: 'adzuna',
  kind: 'jobs',
  async searchJobs() {
    return { jobs: [], report: { providerId: 'adzuna', requestPath: '/search', httpStatus: 0, latencyMs: 0, error: 'missing keys' } };
  },
};

vi.mock('@/lib/api/registry', () => ({ listJobProviders: () => [okProvider, emptyProvider] }));
const upsertExternalJobs = vi.fn().mockResolvedValue(undefined);
const upsertExternalCompanies = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/repositories/supabase/research-repository', () => ({
  upsertExternalJobs: (...a: unknown[]) => upsertExternalJobs(...a),
  upsertExternalCompanies: (...a: unknown[]) => upsertExternalCompanies(...a),
}));
const append = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/repositories/server', () => ({ getApiCallLogRepository: () => ({ append }) }));
vi.mock('@/lib/repositories/supabase/research-preferences-repository', () => ({
  getSearchPreferences: async () => ({ keywords: ['react'], location: '', remote: 'any' }),
}));
vi.mock('@/lib/repositories/supabase/resume-keywords', () => ({ getResumeKeywords: async () => [] }));

import { runResearchRefresh } from '@/lib/research/pipeline';

describe('runResearchRefresh', () => {
  beforeEach(() => {
    upsertExternalJobs.mockClear();
    upsertExternalCompanies.mockClear();
    append.mockClear();
  });

  test('fans out, upserts jobs + companies, logs every provider call', async () => {
    const summary = await runResearchRefresh();
    expect(summary.providersCalled).toBe(2);
    expect(summary.jobsUpserted).toBe(1);
    expect(summary.errors).toEqual([{ providerId: 'adzuna', error: 'missing keys' }]);
    expect(upsertExternalJobs).toHaveBeenCalledTimes(1);
    expect(upsertExternalCompanies).toHaveBeenCalledTimes(1);
    expect(append).toHaveBeenCalledTimes(2); // one per provider report
  });
});
