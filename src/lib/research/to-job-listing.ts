import type { JobListing, RemoteMode } from '@/lib/types';
import type { ExternalJob as ProviderJob } from '@/lib/api/types';
import { companySlug } from '@/lib/research/derive-companies';
import { computeMatchScore } from '@/lib/research/match-score';

function toRemoteMode(remote: ProviderJob['remote']): RemoteMode {
  switch (remote) {
    case 'remote':
      return 'Remote';
    case 'hybrid':
      return 'Hybrid';
    default:
      return 'Onsite';
  }
}

/** Stable synthetic id so the client can key rows and post actions back. */
export function externalJobKey(job: ProviderJob): string {
  return `${job.sourceProvider}:${job.sourceId}`;
}

/**
 * `JobListing` plus the raw description/apply-url text carried through from
 * the provider. Kept separate from `src/lib/types.ts` so the seed-backed
 * `JobListing` type stays untouched — these fields are only ever populated
 * for live (supabase-adapter) listings.
 */
export type JobListingWithDetails = JobListing & {
  description?: string;
  applyUrl?: string;
};

export function toJobListing(job: ProviderJob, keywords: string[]): JobListingWithDetails {
  return {
    id: externalJobKey(job),
    displayId: `JOB-${job.sourceId}`,
    company: companySlug(job.companyName),
    role: job.title,
    location: job.location?.trim() || '—',
    remote: toRemoteMode(job.remote),
    salaryMin: job.salaryMin ?? 0,
    salaryMax: job.salaryMax ?? 0,
    posted: (job.postedAt ?? new Date().toISOString()).slice(0, 10),
    match: computeMatchScore(job, keywords),
    tags: job.tags ?? [],
    saved: false,
    ...(job.description ? { description: job.description } : {}),
    ...(job.applyUrl ? { applyUrl: job.applyUrl } : {}),
  };
}
