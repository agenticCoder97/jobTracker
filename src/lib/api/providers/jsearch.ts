/**
 * JSearch (RapidAPI) jobs provider — TEMPLATE.
 *
 * Aggregates LinkedIn / Indeed / Glassdoor postings under a partner agreement,
 * which is why it's safer to ship than direct scraping. Paid.
 *
 * Env vars:
 *   RAPIDAPI_KEY
 *   RAPIDAPI_JSEARCH_HOST  // default 'jsearch.p.rapidapi.com'
 */

import 'server-only';

import { fetchProvider } from '@/lib/api/client';
import type { ExternalJob, JobProvider } from '@/lib/api/types';

export const jsearch: JobProvider = {
  id: 'jsearch',
  kind: 'jobs',
  async searchJobs(query) {
    const key = process.env.RAPIDAPI_KEY;
    const host = process.env.RAPIDAPI_JSEARCH_HOST ?? 'jsearch.p.rapidapi.com';
    if (!key) {
      return {
        jobs: [],
        report: {
          providerId: 'jsearch',
          requestPath: '/search-v2',
          httpStatus: 0,
          latencyMs: 0,
          error: 'missing RAPIDAPI_KEY',
        },
      };
    }

    const params = new URLSearchParams({
      query: [...(query.keywords ?? []), query.location ?? ''].join(' ').trim() || 'software',
      country: 'us',
      language: 'en',
    });
    if (query.remote === 'remote') params.set('work_from_home', 'true');

    const url = `https://${host}/search-v2?${params}`;
    const { data, report } = await fetchProvider<JSearchResponse>({
      providerId: 'jsearch',
      url,
      init: {
        headers: {
          'x-rapidapi-key': key,
          'x-rapidapi-host': host,
        },
      },
      rateLimitHeader: 'x-ratelimit-requests-remaining',
    });

    const results = Array.isArray(data?.data) ? data.data : (data?.data?.jobs ?? []);
    const jobs: ExternalJob[] = results.map((j) => ({
      sourceProvider: 'jsearch',
      sourceId: j.job_id,
      title: j.job_title,
      companyName: j.employer_name ?? 'Unknown',
      companyDomain: j.employer_website,
      location: j.job_city
        ? [j.job_city, j.job_state, j.job_country].filter(Boolean).join(', ')
        : j.job_country,
      remote: j.job_is_remote ? 'remote' : 'onsite',
      salaryMin: j.job_min_salary ?? undefined,
      salaryMax: j.job_max_salary ?? undefined,
      currency: j.job_salary_currency ?? undefined,
      postedAt: j.job_posted_at_datetime_utc ?? undefined,
      applyUrl: j.job_apply_link,
      description: j.job_description,
      raw: j,
    }));
    return { jobs, report };
  },
};

type JSearchResponse = { data?: JSearchJob[] | { jobs?: JSearchJob[]; cursor?: string } };
type JSearchJob = {
  job_id: string;
  job_title: string;
  job_description?: string;
  job_apply_link?: string;
  employer_name?: string;
  employer_website?: string;
  job_city?: string;
  job_state?: string;
  job_country?: string;
  job_is_remote?: boolean;
  job_min_salary?: number | null;
  job_max_salary?: number | null;
  job_salary_currency?: string | null;
  job_posted_at_datetime_utc?: string;
};
