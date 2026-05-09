'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type {
  JobsParams,
  JobsRemoteFilter,
  JobsScope,
  JobsStatusFilter,
} from '@/components/jobs/use-jobs-rows';
import type { RemoteMode, StatusId } from '@/lib/types';

const scopes: JobsScope[] = ['all', 'tracked', 'matched', 'open'];
const statuses: JobsStatusFilter[] = [
  'all',
  'open',
  'wishlist',
  'applied',
  'screen',
  'interview',
  'offer',
  'rejected',
];
const modes: JobsRemoteFilter[] = ['all', 'Remote', 'Hybrid', 'Onsite'];

export function jobsParamsFromSearchParams(searchParams: URLSearchParams): JobsParams {
  const scope = searchParams.get('scope') as JobsScope | null;
  const status = searchParams.get('status') as JobsStatusFilter | null;
  const mode = searchParams.get('mode') as JobsRemoteFilter | null;
  return {
    scope: scope && scopes.includes(scope) ? scope : 'all',
    q: searchParams.get('q') ?? '',
    statusFilter: status && statuses.includes(status) ? status : 'all',
    remoteFilter: mode && modes.includes(mode) ? mode : 'all',
  };
}

export function jobsParamsToQuery(params: JobsParams): string {
  const next = new URLSearchParams();
  if (params.scope !== 'all') next.set('scope', params.scope);
  if (params.q.trim()) next.set('q', params.q.trim());
  if (params.statusFilter !== 'all') next.set('status', params.statusFilter);
  if (params.remoteFilter !== 'all') next.set('mode', params.remoteFilter);
  return next.toString();
}

export function useJobsParams() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const params = jobsParamsFromSearchParams(searchParams);

  return {
    ...params,
    setParams: (
      patch: Partial<{
        scope: JobsScope;
        q: string;
        statusFilter: JobsStatusFilter;
        remoteFilter: RemoteMode | 'all';
        status: StatusId | 'open' | 'all';
        mode: RemoteMode | 'all';
      }>,
    ) => {
      const merged: JobsParams = {
        ...params,
        ...patch,
        statusFilter: patch.status ?? patch.statusFilter ?? params.statusFilter,
        remoteFilter: patch.mode ?? patch.remoteFilter ?? params.remoteFilter,
      };
      const qs = jobsParamsToQuery(merged);
      router.replace(qs ? `${pathname}?${qs}` : pathname);
    },
  };
}
