import type { SortMode } from '@/lib/data/seed';
import type { Activity, AppDocs, Application, StatusId, Uuid } from '@/lib/types';

export type BoardState = {
  applications: Application[];
  activity: Record<Uuid, Activity>;
  appDocs: Record<Uuid, AppDocs>;
  statusSortMode: Record<StatusId, SortMode>;
};

/** Matches the seed's default column sorting. */
export function defaultStatusSortMode(): Record<StatusId, SortMode> {
  return {
    wishlist: 'lastActivity',
    applied: 'lastActivity',
    screen: 'lastActivity',
    interview: 'lastActivity',
    offer: 'lastActivity',
    rejected: 'lastActivity',
  };
}

export function emptyBoardState(): BoardState {
  return { applications: [], activity: {}, appDocs: {}, statusSortMode: defaultStatusSortMode() };
}
