import type { ExternalCompany, ExternalJob } from '@/lib/api/types';

export function companySlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** One ExternalCompany per distinct, known company name found in a job batch. */
export function deriveCompaniesFromJobs(jobs: ExternalJob[]): ExternalCompany[] {
  const byName = new Map<string, ExternalCompany>();
  for (const job of jobs) {
    const name = job.companyName?.trim();
    if (!name || name.toLowerCase() === 'unknown') continue;
    if (byName.has(name)) continue;
    const domain = job.companyDomain?.trim() || undefined;
    byName.set(name, {
      sourceProvider: job.sourceProvider,
      sourceId: companySlug(name),
      name,
      ...(domain ? { domain } : {}),
      ...(domain ? { logoUrl: `https://logo.clearbit.com/${domain}` } : {}),
      raw: { derivedFrom: job.sourceProvider },
    });
  }
  return Array.from(byName.values());
}
