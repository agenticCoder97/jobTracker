import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { ExternalJob, JobProvider, ProviderCallReport } from '@/lib/api/types';

const okSearchJobs = vi.fn(async () => {
  const jobs: ExternalJob[] = [
    {
      sourceProvider: 'themuse',
      sourceId: 'a',
      title: 'React Engineer',
      companyName: 'Acme',
      tags: ['react'],
      raw: null,
    },
  ];
  const report: ProviderCallReport = {
    providerId: 'themuse',
    requestPath: '/jobs',
    httpStatus: 200,
    latencyMs: 5,
  };
  return {
    jobs,
    report,
  };
});

const okProvider: JobProvider = {
  id: 'themuse',
  kind: 'jobs',
  searchJobs: okSearchJobs,
};
const emptyProvider: JobProvider = {
  id: 'adzuna',
  kind: 'jobs',
  async searchJobs() {
    return {
      jobs: [],
      report: {
        providerId: 'adzuna',
        requestPath: '/search',
        httpStatus: 0,
        latencyMs: 0,
        error: 'missing keys',
      },
    };
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
  getSearchPreferences: async () => ({
    keywords: ['senior java engineer', 'spring boot'],
    location: 'Santa Clara, CA',
    remote: 'hybrid',
  }),
}));
vi.mock('@/lib/repositories/supabase/resume-keywords', () => ({
  getResumeKeywords: async () => [],
}));

import { runResearchRefresh } from '@/lib/research/pipeline';

describe('runResearchRefresh', () => {
  beforeEach(() => {
    okSearchJobs.mockClear();
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
    expect(okSearchJobs).toHaveBeenCalledWith({
      keywords: ['senior java engineer', 'spring boot'],
      location: 'Santa Clara, CA',
      remote: 'hybrid',
      pageSize: 20,
    });
  });
});
