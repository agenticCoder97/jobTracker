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

export function toJobListing(job: ProviderJob, keywords: string[]): JobListing {
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
  };
}
