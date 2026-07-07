/**
 * Adzuna jobs provider — TEMPLATE.
 *
 * Free tier: https://developer.adzuna.com/
 * Auth: app_id + app_key as query params on every request.
 *
 * Env vars (set later in Vercel + .env.local):
 *   ADZUNA_APP_ID
 *   ADZUNA_APP_KEY
 *   ADZUNA_COUNTRY     // 'us' | 'gb' | …, default 'us'
 *
 * Implementation deferred until phase 2 of the plan.
 */

import 'server-only';

import { fetchProvider } from '@/lib/api/client';
import type { ExternalJob, JobProvider } from '@/lib/api/types';

export const adzuna: JobProvider = {
  id: 'adzuna',
  kind: 'jobs',
  async searchJobs(query) {
    const country = process.env.ADZUNA_COUNTRY ?? 'us';
    const appId = process.env.ADZUNA_APP_ID;
    const appKey = process.env.ADZUNA_APP_KEY;

    if (!appId || !appKey) {
      return {
        jobs: [],
        report: {
          providerId: 'adzuna',
          requestPath: '/search',
          httpStatus: 0,
          latencyMs: 0,
          error: 'missing ADZUNA_APP_ID / ADZUNA_APP_KEY',
        },
      };
    }

    const params = new URLSearchParams({
      app_id: appId,
      app_key: appKey,
      results_per_page: String(query.pageSize ?? 20),
      'content-type': 'application/json',
    });
    if (query.keywords?.length) params.set('what', query.keywords.join(' '));
    if (query.location) params.set('where', query.location);
    if (query.minSalary) params.set('salary_min', String(query.minSalary));

    const page = query.page ?? 1;
    const url = `https://api.adzuna.com/v1/api/jobs/${country}/search/${page}?${params}`;

    const { data, report } = await fetchProvider<AdzunaSearchResponse>({
      providerId: 'adzuna',
      url,
      rateLimitHeader: 'X-RateLimit-Remaining',
    });

    const jobs: ExternalJob[] = (data?.results ?? []).map(toExternalJob);
    return { jobs, report };
  },
};

function toExternalJob(r: AdzunaResult): ExternalJob {
  return {
    sourceProvider: 'adzuna',
    sourceId: String(r.id),
    title: r.title,
    companyName: r.company?.display_name ?? 'Unknown',
    location: r.location?.display_name,
    salaryMin: r.salary_min,
    salaryMax: r.salary_max,
    postedAt: r.created,
    applyUrl: r.redirect_url,
    description: r.description,
    raw: r,
  };
}

type AdzunaSearchResponse = {
  results?: AdzunaResult[];
};

type AdzunaResult = {
  id: number | string;
  title: string;
  description?: string;
  company?: { display_name?: string };
  location?: { display_name?: string };
  salary_min?: number;
  salary_max?: number;
  created?: string;
  redirect_url?: string;
};
