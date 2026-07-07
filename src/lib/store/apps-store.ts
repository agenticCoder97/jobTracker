'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { seedAll, type SortMode } from '@/lib/data/seed';
import { emptyBoardState, type BoardState } from '@/lib/data/board-defaults';
import { computeAts } from '@/lib/utils/ats';
import { daysAgo } from '@/lib/utils/dates';
import { slugifyCompanyId } from '@/lib/company-logos';
import { getPersistenceAdapter } from '@/lib/supabase/env';
import type {
  Activity,
  AppDocs,
  ApplicationLink,
  Application,
  Attachment,
  DailyPick,
  HistoryEvent,
  JobListing,
  Priority,
  RemoteMode,
  StatusId,
  Uuid,
} from '@/lib/types';
import { DEMO_USER_ID } from '@/lib/types';
import { useProfileStore } from '@/lib/store/profile-store';
import { recordAudit } from '@/lib/store/audit';

const seeded = getPersistenceAdapter() === 'local';

function freshBoard(): BoardState {
  if (!seeded) return emptyBoardState();
  const fresh = seedAll();
  return {
    applications: fresh.applications,
    activity: fresh.activity,
    appDocs: fresh.appDocs,
    statusSortMode: fresh.statusSortMode,
  };
}

const initialBoard = freshBoard();

export type NewApplicationInput = {
  status: StatusId;
  companyName: string;
  role: string;
  location?: string;
  remote?: RemoteMode;
  salaryMin?: number;
  salaryMax?: number;
  priority?: Priority;
  tags?: string[];
  postingUrl?: string;
  description?: string;
};

type AppsState = {
  applications: Application[];
  activity: Record<Uuid, Activity>;
  appDocs: Record<Uuid, AppDocs>;
  statusSortMode: Record<StatusId, SortMode>;
  getByDisplayId: (displayId: string) => Application | undefined;
  createCard: (input: NewApplicationInput) => Application;
  updateApp: (id: Uuid, patch: Partial<Application>, text?: string) => void;
  moveStatus: (id: Uuid, status: StatusId) => void;
  reorderInStatus: (status: StatusId, orderedIds: Uuid[]) => void;
  setStatusSortMode: (status: StatusId, mode: SortMode) => void;
  addComment: (applicationId: Uuid, text: string) => void;
  addAttachment: (applicationId: Uuid, input: Omit<Attachment, 'id' | 'when'>) => Attachment;
  removeAttachment: (applicationId: Uuid, attachmentId: Uuid) => void;
  addLink: (applicationId: Uuid, input: Omit<ApplicationLink, 'id'>) => void;
  removeLink: (applicationId: Uuid, linkId: Uuid) => void;
  addToWishlist: (listing: JobListing | DailyPick, source?: 'Jobs' | 'Research') => Application;
  applyCard: (id: Uuid, docs: { resumeId: Uuid; coverLetterId: Uuid | null }) => void;
  archiveApp: (id: Uuid) => void;
  deleteApp: (id: Uuid) => void;
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
  const numbers = applications.map((app) => Number(app.displayId.replace('JT-', '')));
  const nextNumber = (numbers.length > 0 ? Math.max(...numbers) : 0) + 1;
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

function listingId(input: JobListing | DailyPick): Uuid {
  return input.id;
}

function sync(appId: Uuid): void {
  void import('@/lib/store/apps-sync').then((mod) => mod.queuePersist(appId));
}

function syncMany(appIds: Uuid[]): void {
  void import('@/lib/store/apps-sync').then((mod) => mod.persistMany(appIds));
}

function syncReset(): void {
  void import('@/lib/store/apps-sync').then((mod) => mod.resetServer());
}

export const useAppsStore = create<AppsState>()(
  persist(
    (set, get) => ({
      applications: initialBoard.applications,
      activity: initialBoard.activity,
      appDocs: initialBoard.appDocs,
      statusSortMode: initialBoard.statusSortMode,
      getByDisplayId: (displayId) =>
        get().applications.find((app) => app.displayId === displayId && !app.deletedAt),
      createCard: (input) => {
        const displayId = nextDisplayId(get().applications);
        const now = new Date().toISOString();
        const app: Application = {
          id: crypto.randomUUID(),
          ownerUserId: DEMO_USER_ID,
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
          displayId,
          status: input.status,
          company: slugifyCompanyId(input.companyName),
          companyName: input.companyName.trim(),
          role: input.role.trim(),
          location: input.location?.trim() || 'Remote',
          remote: input.remote ?? 'Remote',
          salaryMin: input.salaryMin ?? 0,
          salaryMax: input.salaryMax ?? 0,
          level: 'Senior',
          team: 'Product',
          posted: daysAgo(0),
          applied: input.status === 'wishlist' ? null : daysAgo(0),
          lastActivity: now,
          priority: input.priority ?? 'med',
          source: 'Manual entry',
          progress: input.status === 'wishlist' ? 5 : 20,
          tags: input.tags ?? [],
          sourceListingId: null,
          sortIndex: get().applications.filter((item) => item.status === input.status).length,
          archivedAt: null,
        };
        if (input.postingUrl?.trim()) app.postingUrl = input.postingUrl.trim();
        if (input.description?.trim()) app.description = input.description.trim();
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
        recordAudit('application', app.id, 'created', { source: 'manual', status: input.status });
        sync(app.id);
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
        recordAudit('application', id, 'fields_edited', { fields: Object.keys(patch) });
        sync(id);
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
        recordAudit('application', id, 'status_changed', { to: status });
        sync(id);
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
        recordAudit('application', status, 'reordered', { count: orderedIds.length });
        syncMany(orderedIds);
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
        recordAudit('application', applicationId, 'comment_added');
        sync(applicationId);
      },
      addAttachment: (applicationId, input) => {
        const attachment: Attachment = {
          ...input,
          id: crypto.randomUUID(),
          when: new Date().toISOString(),
        };
        const text =
          input.source === 'resume'
            ? `Resume linked: ${input.name}`
            : input.source === 'cover-letter'
              ? `Cover letter linked: ${input.name}`
              : `Attachment added: ${input.name}`;
        set((state) => ({
          activity: {
            ...state.activity,
            [applicationId]: {
              ...(state.activity[applicationId] ?? emptyActivity()),
              attachments: [attachment, ...(state.activity[applicationId]?.attachments ?? [])],
              history: [
                historyEvent('attach', text),
                ...(state.activity[applicationId]?.history ?? []),
              ],
            },
          },
          applications: state.applications.map((app) =>
            app.id === applicationId ? bump(app) : app,
          ),
        }));
        recordAudit('application', applicationId, 'attachment_added', {
          name: input.name,
          source: input.source ?? 'upload',
        });
        sync(applicationId);
        return attachment;
      },
      removeAttachment: (applicationId, attachmentId) => {
        const target = get().activity[applicationId]?.attachments.find(
          (item) => item.id === attachmentId,
        );
        if (!target) return;
        set((state) => ({
          activity: {
            ...state.activity,
            [applicationId]: {
              ...(state.activity[applicationId] ?? emptyActivity()),
              attachments: (state.activity[applicationId]?.attachments ?? []).filter(
                (item) => item.id !== attachmentId,
              ),
              history: [
                historyEvent('attach', `Attachment removed: ${target.name}`),
                ...(state.activity[applicationId]?.history ?? []),
              ],
            },
          },
          applications: state.applications.map((app) =>
            app.id === applicationId ? bump(app) : app,
          ),
        }));
        recordAudit('application', applicationId, 'attachment_removed', { name: target.name });
        sync(applicationId);
      },
      addLink: (applicationId, input) => {
        const link: ApplicationLink = { ...input, id: crypto.randomUUID() };
        set((state) => ({
          activity: {
            ...state.activity,
            [applicationId]: {
              ...(state.activity[applicationId] ?? emptyActivity()),
              links: [link, ...(state.activity[applicationId]?.links ?? [])],
              history: [
                historyEvent('link', `Link added: ${input.title}`),
                ...(state.activity[applicationId]?.history ?? []),
              ],
            },
          },
          applications: state.applications.map((app) =>
            app.id === applicationId ? bump(app) : app,
          ),
        }));
        recordAudit('application', applicationId, 'link_added', { title: input.title });
        sync(applicationId);
      },
      removeLink: (applicationId, linkId) => {
        const target = get().activity[applicationId]?.links.find((item) => item.id === linkId);
        if (!target) return;
        set((state) => ({
          activity: {
            ...state.activity,
            [applicationId]: {
              ...(state.activity[applicationId] ?? emptyActivity()),
              links: (state.activity[applicationId]?.links ?? []).filter(
                (item) => item.id !== linkId,
              ),
              history: [
                historyEvent('link', `Link removed: ${target.title}`),
                ...(state.activity[applicationId]?.history ?? []),
              ],
            },
          },
          applications: state.applications.map((app) =>
            app.id === applicationId ? bump(app) : app,
          ),
        }));
        recordAudit('application', applicationId, 'link_removed', { title: target.title });
        sync(applicationId);
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
          id: crypto.randomUUID(),
          ownerUserId: DEMO_USER_ID,
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
        recordAudit('application', app.id, 'wishlist_added', { source, sourceId });
        sync(app.id);
        return app;
      },
      applyCard: (id, docs) => {
        const resume = useProfileStore.getState().resumes.find((item) => item.id === docs.resumeId);
        const targetApp = get().applications.find((app) => app.id === id);
        const required =
          targetApp?.requirements && targetApp.requirements.length > 0
            ? targetApp.requirements
            : (targetApp?.tags ?? []);
        const nice = targetApp?.tags?.filter((tag) => !required.includes(tag)) ?? [];
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
                    required,
                    nice,
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
        recordAudit('application', id, 'application_submitted', {
          resumeId: docs.resumeId,
          coverLetterId: docs.coverLetterId,
        });
        sync(id);
      },
      archiveApp: (id) => {
        const isArchived = Boolean(get().applications.find((app) => app.id === id)?.archivedAt);
        const archivedAt = isArchived ? null : new Date().toISOString();
        set((state) => ({
          applications: state.applications.map((app) =>
            app.id === id ? bump({ ...app, archivedAt }) : app,
          ),
          activity: {
            ...state.activity,
            [id]: {
              ...(state.activity[id] ?? emptyActivity()),
              history: [
                historyEvent('field', archivedAt ? 'Card archived' : 'Card unarchived'),
                ...(state.activity[id]?.history ?? []),
              ],
            },
          },
        }));
        recordAudit('application', id, archivedAt ? 'archived' : 'unarchived');
        sync(id);
      },
      deleteApp: (id) => {
        set((state) => ({
          applications: state.applications.map((app) =>
            app.id === id ? { ...app, deletedAt: new Date().toISOString() } : app,
          ),
        }));
        recordAudit('application', id, 'deleted');
        sync(id);
      },
      reset: () => {
        set(freshBoard());
        recordAudit('demo', 'apps', 'reset');
        syncReset();
      },
    }),
    {
      name: 'jobtracker:apps:v1',
      version: 1,
      skipHydration: true,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        applications: state.applications,
        activity: state.activity,
        appDocs: state.appDocs,
        statusSortMode: state.statusSortMode,
      }),
      migrate: (persistedState) => persistedState as AppsState,
    },
  ),
);
