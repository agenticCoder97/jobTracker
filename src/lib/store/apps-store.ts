'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { seedAll, seedUuid, type SortMode } from '@/lib/data/seed';
import { computeAts } from '@/lib/utils/ats';
import { daysAgo } from '@/lib/utils/dates';
import type {
  Activity,
  AppDocs,
  Application,
  DailyPick,
  HistoryEvent,
  JobListing,
  RemoteMode,
  StatusId,
  Uuid,
} from '@/lib/types';
import { useProfileStore } from '@/lib/store/profile-store';

const seed = seedAll();

type AppsState = {
  applications: Application[];
  activity: Record<Uuid, Activity>;
  appDocs: Record<Uuid, AppDocs>;
  statusSortMode: Record<StatusId, SortMode>;
  getByDisplayId: (displayId: string) => Application | undefined;
  createCard: (status: StatusId) => Application;
  updateApp: (id: Uuid, patch: Partial<Application>, text?: string) => void;
  moveStatus: (id: Uuid, status: StatusId) => void;
  reorderInStatus: (status: StatusId, orderedIds: Uuid[]) => void;
  setStatusSortMode: (status: StatusId, mode: SortMode) => void;
  addComment: (applicationId: Uuid, text: string) => void;
  addToWishlist: (listing: JobListing | DailyPick, source?: 'Jobs' | 'Research') => Application;
  applyCard: (id: Uuid, docs: { resumeId: Uuid; coverLetterId: Uuid | null }) => void;
  reset: () => void;
};

function emptyActivity(): Activity {
  return { comments: [], history: [], links: [], attachments: [] };
}

function historyEvent(type: HistoryEvent['type'], text: string): HistoryEvent {
  return {
    id: crypto.randomUUID(),
    type,
    when: new Date().toISOString(),
    who: 'me',
    text,
  };
}

function bump(app: Application): Application {
  const now = new Date().toISOString();
  return { ...app, updatedAt: now, lastActivity: now };
}

function nextDisplayId(applications: Application[]): string {
  const nextNumber =
    Math.max(...applications.map((app) => Number(app.displayId.replace('JT-', '')))) + 1;
  return `JT-${nextNumber}`;
}

function modeFromLocation(location: string): RemoteMode {
  if (location.toLowerCase().includes('remote')) return 'Remote';
  if (location.toLowerCase().includes('onsite')) return 'Onsite';
  return 'Hybrid';
}

function salaryMinFromPick(pick: DailyPick): number {
  const first = pick.salary.match(/\$([0-9]+)/)?.[1];
  return first ? Number(first) : 180;
}

function salaryMaxFromPick(pick: DailyPick): number {
  const values = Array.from(pick.salary.matchAll(/([0-9]+)K/g)).map((match) => Number(match[1]));
  return values.at(-1) ?? salaryMinFromPick(pick) + 60;
}

function listingId(input: JobListing | DailyPick): string {
  return 'displayId' in input ? input.displayId : input.id;
}

export const useAppsStore = create<AppsState>()(
  persist(
    (set, get) => ({
      applications: seed.applications,
      activity: seed.activity,
      appDocs: seed.appDocs,
      statusSortMode: seed.statusSortMode,
      getByDisplayId: (displayId) => get().applications.find((app) => app.displayId === displayId),
      createCard: (status) => {
        const displayId = nextDisplayId(get().applications);
        const app: Application = {
          id: seedUuid(displayId),
          ownerUserId: seed.applications[0]?.ownerUserId ?? '00000000-0000-0000-0000-000000000001',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          deletedAt: null,
          displayId,
          status,
          company: 'anthropic',
          role: 'New application',
          location: 'Remote (US)',
          remote: 'Remote',
          salaryMin: 180,
          salaryMax: 240,
          level: 'Senior',
          team: 'Product',
          posted: daysAgo(0),
          applied: null,
          lastActivity: new Date().toISOString(),
          priority: 'med',
          source: 'Manual entry',
          progress: status === 'wishlist' ? 5 : 20,
          tags: ['Draft'],
          description: 'Add notes about this role.',
          sourceListingId: null,
          sortIndex: get().applications.filter((item) => item.status === status).length,
          archivedAt: null,
        };
        set((state) => ({
          applications: [app, ...state.applications],
          activity: {
            ...state.activity,
            [app.id]: {
              ...emptyActivity(),
              history: [historyEvent('created', 'Card created manually')],
            },
          },
        }));
        return app;
      },
      updateApp: (id, patch, text = 'Application updated') => {
        set((state) => ({
          applications: state.applications.map((app) =>
            app.id === id ? bump({ ...app, ...patch }) : app,
          ),
          activity: {
            ...state.activity,
            [id]: {
              ...(state.activity[id] ?? emptyActivity()),
              history: [historyEvent('field', text), ...(state.activity[id]?.history ?? [])],
            },
          },
        }));
      },
      moveStatus: (id, status) => {
        set((state) => ({
          applications: state.applications.map((app) =>
            app.id === id
              ? bump({
                  ...app,
                  status,
                  progress: Math.max(app.progress, status === 'applied' ? 20 : app.progress),
                  sortIndex: 0,
                })
              : app,
          ),
          activity: {
            ...state.activity,
            [id]: {
              ...(state.activity[id] ?? emptyActivity()),
              history: [
                historyEvent('status', `Status changed to ${status}`),
                ...(state.activity[id]?.history ?? []),
              ],
            },
          },
          statusSortMode: { ...state.statusSortMode, [status]: 'manual' },
        }));
      },
      reorderInStatus: (status, orderedIds) => {
        const indexById = new Map(orderedIds.map((id, index) => [id, index]));
        set((state) => ({
          applications: state.applications.map((app) =>
            app.status === status && indexById.has(app.id)
              ? { ...app, sortIndex: indexById.get(app.id) ?? app.sortIndex }
              : app,
          ),
          statusSortMode: { ...state.statusSortMode, [status]: 'manual' },
        }));
      },
      setStatusSortMode: (status, mode) => {
        set((state) => ({ statusSortMode: { ...state.statusSortMode, [status]: mode } }));
      },
      addComment: (applicationId, text) => {
        const trimmed = text.trim();
        if (!trimmed) return;
        set((state) => ({
          activity: {
            ...state.activity,
            [applicationId]: {
              ...(state.activity[applicationId] ?? emptyActivity()),
              comments: [
                {
                  id: crypto.randomUUID(),
                  who: 'me',
                  when: new Date().toISOString(),
                  text: trimmed,
                },
                ...(state.activity[applicationId]?.comments ?? []),
              ],
              history: [
                historyEvent('comment', 'Comment added'),
                ...(state.activity[applicationId]?.history ?? []),
              ],
            },
          },
          applications: state.applications.map((app) =>
            app.id === applicationId ? bump(app) : app,
          ),
        }));
      },
      addToWishlist: (input, source = 'Jobs') => {
        const sourceId = listingId(input);
        const existing = get().applications.find((app) => app.sourceListingId === sourceId);
        if (existing) return existing;

        const displayId = nextDisplayId(get().applications);
        const now = new Date().toISOString();
        const salaryMin = 'salaryMin' in input ? input.salaryMin : salaryMinFromPick(input);
        const salaryMax = 'salaryMax' in input ? input.salaryMax : salaryMaxFromPick(input);
        const equity =
          'salary' in input && input.salary.includes('+')
            ? input.salary.split('+').at(1)?.trim()
            : undefined;
        const app: Application = {
          id: seedUuid(displayId),
          ownerUserId: seed.applications[0]?.ownerUserId ?? '00000000-0000-0000-0000-000000000001',
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
          displayId,
          status: 'wishlist',
          company: input.company,
          role: input.role,
          location: input.location,
          remote: 'remote' in input ? input.remote : modeFromLocation(input.location),
          salaryMin,
          salaryMax,
          level: input.role.toLowerCase().includes('staff') ? 'Staff' : 'Senior',
          team: 'Discovery',
          posted:
            'posted' in input && /^\d{4}-\d{2}-\d{2}$/.test(input.posted)
              ? input.posted
              : daysAgo(0),
          applied: null,
          lastActivity: now,
          priority: input.match >= 85 ? 'high' : 'med',
          source: `${source} discovery`,
          progress: 5,
          tags: 'tags' in input ? input.tags : input.why.slice(0, 2),
          description: `Discovered from ${source}. Match score ${input.match}%.`,
          sourceListingId: sourceId,
          sortIndex: get().applications.filter((item) => item.status === 'wishlist').length,
          archivedAt: null,
        };
        if (equity) app.equity = equity;
        set((state) => ({
          applications: [app, ...state.applications],
          activity: {
            ...state.activity,
            [app.id]: {
              ...emptyActivity(),
              history: [historyEvent('created', `Added to wishlist from ${source}`)],
            },
          },
        }));
        return app;
      },
      applyCard: (id, docs) => {
        const resume = useProfileStore.getState().resumes.find((item) => item.id === docs.resumeId);
        set((state) => ({
          applications: state.applications.map((app) =>
            app.id === id
              ? bump({
                  ...app,
                  status: 'applied',
                  applied: daysAgo(0),
                  progress: Math.max(20, app.progress),
                })
              : app,
          ),
          appDocs: resume
            ? {
                ...state.appDocs,
                [id]: {
                  applicationId: id,
                  resumeId: docs.resumeId,
                  coverLetterId: docs.coverLetterId,
                  ats: computeAts({
                    resumeKeywords: resume.keywords,
                    required: ['TypeScript', 'React', 'Distributed systems'],
                    nice: ['Observability', 'Kafka'],
                  }),
                },
              }
            : state.appDocs,
          activity: {
            ...state.activity,
            [id]: {
              ...(state.activity[id] ?? emptyActivity()),
              history: [
                historyEvent('document', 'Application submitted'),
                ...(state.activity[id]?.history ?? []),
              ],
            },
          },
        }));
        useProfileStore.getState().incrementResumeUse(docs.resumeId);
        if (docs.coverLetterId)
          useProfileStore.getState().incrementCoverLetterUse(docs.coverLetterId);
      },
      reset: () => {
        const fresh = seedAll();
        set({
          applications: fresh.applications,
          activity: fresh.activity,
          appDocs: fresh.appDocs,
          statusSortMode: fresh.statusSortMode,
        });
      },
    }),
    {
      name: 'jobtracker:apps:v1',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        applications: state.applications,
        activity: state.activity,
        appDocs: state.appDocs,
        statusSortMode: state.statusSortMode,
      }),
    },
  ),
);
