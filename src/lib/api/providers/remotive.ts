/**
 * Remotive public remote-jobs provider.
 *
 * No key required. Remotive asks API consumers to preserve/link back to the
 * Remotive URL, so `applyUrl` intentionally remains the Remotive listing URL.
 */

import 'server-only';

import { fetchProvider } from '@/lib/api/client';
import type { ExternalJob, JobProvider } from '@/lib/api/types';

export const remotive: JobProvider = {
  id: 'remotive',
  kind: 'jobs',
  async searchJobs(query) {
    const params = new URLSearchParams();
    const search = (query.keywords ?? []).join(' ').trim();
    if (search) params.set('search', search);
    if (query.pageSize) params.set('limit', String(query.pageSize));

    const url = `https://remotive.com/api/remote-jobs?${params}`;
    const { data, report } = await fetchProvider<RemotiveResponse>({
      providerId: 'remotive',
      url,
    });

    const jobs: ExternalJob[] = (data?.jobs ?? []).map((job) => ({
      sourceProvider: 'remotive',
      sourceId: String(job.id),
      title: job.title,
      companyName: job.company_name,
      location: job.candidate_required_location,
      remote: 'remote',
      salaryMin: parseSalary(job.salary).min,
      salaryMax: parseSalary(job.salary).max,
      postedAt: job.publication_date,
      applyUrl: job.url,
      description: stripHtml(job.description ?? ''),
      tags: [...(job.tags ?? []), ...(job.category ? [job.category] : [])],
      raw: job,
    }));
    return { jobs, report };
  },
};

function stripHtml(value: string): string {
  return value
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseSalary(value: string | undefined): { min?: number; max?: number } {
  if (!value) return {};
  const numbers = Array.from(value.matchAll(/\$?\s*(\d{2,3})(?:,\d{3})?\s*k?/gi))
    .map((match) => Number(match[1]))
    .filter((parsed) => Number.isFinite(parsed))
    .map((parsed) => (parsed < 1000 ? parsed * 1000 : parsed));
  if (numbers.length === 0) return {};
  const min = Math.min(...numbers);
  const max = Math.max(...numbers);
  if (numbers.length === 1) return { min, max };
  return { min, max };
}

type RemotiveResponse = { jobs?: RemotiveJob[] };
type RemotiveJob = {
  id: number | string;
  title: string;
  company_name: string;
  candidate_required_location?: string;
  salary?: string;
  publication_date?: string;
  url?: string;
  description?: string;
  tags?: string[];
  category?: string;
};
