'use client';

/**
 * Fire-and-forget write-through from the Zustand board store to /api/apps.
 * Local state is the optimistic source of truth; this module syncs it to
 * Supabase in the background. Per-application debounce coalesces bursts
 * (drag reorder, contentEditable blurs). One retry, then a warning toast:
 * the local copy is never rolled back.
 */

import { useAppsStore } from '@/lib/store/apps-store';
import { useUiStore } from '@/lib/store/ui-store';
import type { Uuid } from '@/lib/types';

const DEBOUNCE_MS = 400;

function syncEnabled(): boolean {
  return process.env.NEXT_PUBLIC_PERSISTENCE_ADAPTER === 'supabase';
}

const pending = new Map<Uuid, ReturnType<typeof setTimeout>>();

export function __resetSyncForTests(): void {
  for (const timer of pending.values()) clearTimeout(timer);
  pending.clear();
}

/** Queue a debounced persist of one application's current bundle. */
export function queuePersist(appId: Uuid): void {
  if (!syncEnabled() || typeof window === 'undefined') return;
  const existing = pending.get(appId);
  if (existing) clearTimeout(existing);
  pending.set(
    appId,
    setTimeout(() => {
      pending.delete(appId);
      void flush(appId);
    }, DEBOUNCE_MS),
  );
}

async function flush(appId: Uuid): Promise<void> {
  const state = useAppsStore.getState();
  const application = state.applications.find((app) => app.id === appId);
  if (!application) return;
  const activity = state.activity[appId];
  const docs = state.appDocs[appId];
  const body = JSON.stringify({
    bundles: [
      {
        application,
        ...(activity ? { activity } : {}),
        ...(docs ? { docs } : {}),
      },
    ],
  });
  const ok = await putOnce(body).catch(() => false);
  if (ok) return;
  const retried = await putOnce(body).catch(() => false);
  if (!retried) {
    useUiStore.getState().pushToast({
      kind: 'error',
      message: 'Sync failed - change saved locally only.',
    });
  }
}

async function putOnce(body: string): Promise<boolean> {
  const response = await fetch('/api/apps', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body,
  });
  return response.ok;
}

/** Persist many applications at once (board reorder). Not debounced. */
export async function persistMany(appIds: Uuid[]): Promise<void> {
  if (!syncEnabled() || typeof window === 'undefined' || appIds.length === 0) return;
  const state = useAppsStore.getState();
  const bundles = appIds
    .map((id) => state.applications.find((app) => app.id === id))
    .filter((app): app is NonNullable<typeof app> => Boolean(app))
    .map((application) => ({ application }));
  if (bundles.length === 0) return;
  const response = await fetch('/api/apps', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ bundles }),
  }).catch(() => null);
  if (!response?.ok) {
    useUiStore.getState().pushToast({
      kind: 'error',
      message: 'Sync failed - board order saved locally only.',
    });
  }
}

export type ServerAppsState = {
  applications: unknown[];
  activity: Record<string, unknown>;
  appDocs: Record<string, unknown>;
};

/**
 * Hydrate the store from the server. Returns 'server' when server data was
 * applied, 'imported' when the local board was carried over to an empty
 * server, 'offline' when the request failed (local data kept).
 */
export async function hydrateFromServer(): Promise<'server' | 'imported' | 'offline'> {
  if (!syncEnabled()) return 'offline';
  const response = await fetch('/api/apps').catch(() => null);
  if (!response?.ok) return 'offline';
  const server = (await response.json()) as ServerAppsState;

  if (server.applications.length === 0) {
    const local = useAppsStore.getState();
    if (local.applications.length > 0) {
      await fetch('/api/apps/import', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          applications: local.applications,
          activity: local.activity,
          appDocs: local.appDocs,
        }),
      }).catch(() => null);
      return 'imported';
    }
    return 'server';
  }

  useAppsStore.setState({
    applications: server.applications as never,
    activity: server.activity as never,
    appDocs: server.appDocs as never,
  });
  return 'server';
}

/** Clear the server board, then re-import current local state (used by reset). */
export async function resetServer(): Promise<void> {
  if (!syncEnabled() || typeof window === 'undefined') return;
  await fetch('/api/apps', { method: 'DELETE' }).catch(() => null);
  const local = useAppsStore.getState();
  await fetch('/api/apps/import', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      applications: local.applications,
      activity: local.activity,
      appDocs: local.appDocs,
    }),
  }).catch(() => null);
}
