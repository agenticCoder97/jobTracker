/**
 * The Muse jobs provider — TEMPLATE.
 *
 * Public API, no auth required. Docs: https://www.themuse.com/developers/api/v2
 * Coverage limited to participating companies; useful as a polite zero-config
 * default during development.
 */

import 'server-only';

import { fetchProvider } from '@/lib/api/client';
import type { ExternalJob, JobProvider } from '@/lib/api/types';

export const themuse: JobProvider = {
  id: 'themuse',
  kind: 'jobs',
  async searchJobs(query) {
    const params = new URLSearchParams({ page: String(query.page ?? 1) });
    if (query.keywords?.length) params.set('search', query.keywords.join(' '));
    if (query.location) params.set('location', query.location);

    const url = `https://www.themuse.com/api/public/jobs?${params}`;
    const { data, report } = await fetchProvider<MuseResponse>({
      providerId: 'themuse',
      url,
    });

    const jobs: ExternalJob[] = (data?.results ?? []).map((r) => ({
      sourceProvider: 'themuse',
      sourceId: String(r.id),
      title: r.name,
      companyName: r.company?.name ?? 'Unknown',
      location: r.locations?.[0]?.name,
      postedAt: r.publication_date,
      applyUrl: r.refs?.landing_page,
      description: stripHtml(r.contents ?? ''),
      tags: r.categories?.map((c) => c.name) ?? [],
      raw: r,
    }));
    return { jobs, report };
  },
};

function stripHtml(s: string): string {
  return s
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

type MuseResponse = { results?: MuseJob[] };
type MuseJob = {
  id: number | string;
  name: string;
  contents?: string;
  publication_date?: string;
  refs?: { landing_page?: string };
  company?: { name?: string };
  locations?: { name: string }[];
  categories?: { name: string }[];
};
