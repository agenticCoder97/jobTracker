import { COMPANIES, STATUSES } from '@/lib/data/seed';
import type { Application, JobListing, RemoteMode, StatusId } from '@/lib/types';

export type JobsScope = 'all' | 'tracked' | 'matched' | 'open';
export type JobsStatusFilter = StatusId | 'open' | 'all';
export type JobsRemoteFilter = RemoteMode | 'all';

export type JobsParams = {
  scope: JobsScope;
  q: string;
  statusFilter: JobsStatusFilter;
  remoteFilter: JobsRemoteFilter;
};

export type JobsRow =
  | {
      kind: 'tracked';
      id: string;
      displayId: string;
      company: string;
      companyName: string;
      role: string;
      status: StatusId;
      statusLabel: string;
      statusColor: string;
      location: string;
      remote: RemoteMode;
      salaryMin: number;
      salaryMax: number;
      match: null;
      updated: string;
      tags: string[];
      searchText: string;
      application: Application;
    }
  | {
      kind: 'listing';
      id: string;
      displayId: string;
      company: string;
      companyName: string;
      role: string;
      status: 'open';
      statusLabel: 'Open';
      statusColor: string;
      location: string;
      remote: RemoteMode;
      salaryMin: number;
      salaryMax: number;
      match: number;
      updated: string;
      tags: string[];
      searchText: string;
      listing: JobListing;
    };

const openStatus = { statusLabel: 'Open' as const, statusColor: '#6B6B7A' };

function normalizedSearch(parts: Array<string | string[] | null | undefined>): string {
  return parts
    .flatMap((part) => (Array.isArray(part) ? part : [part]))
    .join(' ')
    .toLowerCase();
}

export function buildJobsRows(
  applications: Application[],
  listings: JobListing[],
  params: JobsParams,
): JobsRow[] {
  const trackedListingIds = new Set(
    applications.map((application) => application.sourceListingId).filter(Boolean),
  );
  const includeTracked = params.scope === 'all' || params.scope === 'tracked';
  const includeListings =
    params.scope === 'all' || params.scope === 'matched' || params.scope === 'open';

  const trackedRows: JobsRow[] = includeTracked
    ? applications.map((application) => {
        const companyName = COMPANIES[application.company]?.name ?? application.company;
        const status = STATUSES.find((item) => item.id === application.status);
        const searchText = normalizedSearch([
          application.role,
          companyName,
          application.location,
          application.tags,
        ]);
        return {
          kind: 'tracked',
          id: application.id,
          displayId: application.displayId,
          company: application.company,
          companyName,
          role: application.role,
          status: application.status,
          statusLabel: status?.title ?? application.status,
          statusColor: status?.color ?? '#6B6B7A',
          location: application.location,
          remote: application.remote,
          salaryMin: application.salaryMin,
          salaryMax: application.salaryMax,
          match: null,
          updated: application.lastActivity,
          tags: application.tags,
          searchText,
          application,
        };
      })
    : [];

  const listingRows: JobsRow[] = includeListings
    ? listings
        .filter((listing) => !trackedListingIds.has(listing.displayId))
        .map((listing) => {
          const companyName = COMPANIES[listing.company]?.name ?? listing.company;
          const searchText = normalizedSearch([
            listing.role,
            companyName,
            listing.location,
            listing.tags,
          ]);
          return {
            kind: 'listing',
            id: listing.id,
            displayId: listing.displayId,
            company: listing.company,
            companyName,
            role: listing.role,
            status: 'open',
            ...openStatus,
            location: listing.location,
            remote: listing.remote,
            salaryMin: listing.salaryMin,
            salaryMax: listing.salaryMax,
            match: listing.match,
            updated: listing.posted,
            tags: listing.tags,
            searchText,
            listing,
          };
        })
    : [];

  const query = params.q.trim().toLowerCase();
  return [...trackedRows, ...listingRows].filter((row) => {
    if (query && !row.searchText.includes(query)) return false;
    if (params.statusFilter !== 'all' && row.status !== params.statusFilter) return false;
    if (params.remoteFilter !== 'all' && row.remote !== params.remoteFilter) return false;
    return true;
  });
}
