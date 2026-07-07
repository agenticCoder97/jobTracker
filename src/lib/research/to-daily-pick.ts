import type { DailyPick } from '@/lib/types';
import type { ExternalJob } from '@/lib/api/types';
import { companySlug } from '@/lib/research/derive-companies';
import { externalJobKey } from '@/lib/research/to-job-listing';

function fmtSalary(min?: number, max?: number): string {
  if (!min && !max) return 'Not disclosed';
  const k = (n: number) => `$${Math.round(n / 1000)}k`;
  if (min && max) return `${k(min)}–${k(max)}`;
  return k((min ?? max)!);
}

export function toDailyPick(job: ExternalJob, match: number): DailyPick {
  return {
    id: externalJobKey(job),
    company: companySlug(job.companyName),
    role: job.title,
    location: job.location?.trim() || '—',
    salary: fmtSalary(job.salaryMin, job.salaryMax),
    match,
    why: (job.tags ?? []).slice(0, 3).map((t) => `Matches your interest in ${t}`),
    posted: (job.postedAt ?? '').slice(0, 10) || 'Recently',
    applicants: '—',
  };
}
