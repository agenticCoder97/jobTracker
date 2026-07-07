'use client';

/**
 * Write-through for the document library (resumes + cover letters), mirroring
 * apps-sync: optimistic local state, debounced whole-library PUT (the library
 * is small), one retry, warning toast on persistent failure.
 */

import { useProfileStore } from '@/lib/store/profile-store';
import { useUiStore } from '@/lib/store/ui-store';

const DEBOUNCE_MS = 400;

let timer: ReturnType<typeof setTimeout> | undefined;

function syncEnabled(): boolean {
  return process.env.NEXT_PUBLIC_PERSISTENCE_ADAPTER === 'supabase';
}

export function __resetDocsSyncForTests(): void {
  if (timer) clearTimeout(timer);
  timer = undefined;
}

/** Queue a debounced persist of the whole document library. */
export function queuePersistDocuments(): void {
  if (!syncEnabled() || typeof window === 'undefined') return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = undefined;
    void flush();
  }, DEBOUNCE_MS);
}

async function flush(): Promise<void> {
  const { resumes, coverLetters } = useProfileStore.getState();
  const body = JSON.stringify({ resumes, coverLetters });
  const ok = await putOnce(body).catch(() => false);
  if (ok) return;
  const retried = await putOnce(body).catch(() => false);
  if (!retried) {
    useUiStore.getState().pushToast({
      kind: 'error',
      message: 'Document sync failed - saved locally only.',
    });
  }
}

async function putOnce(body: string): Promise<boolean> {
  const response = await fetch('/api/documents', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body,
  });
  return response.ok;
}

/** Fire-and-forget server delete for a removed document. */
export function deleteDocumentOnServer(type: 'resume' | 'cover-letter', id: string): void {
  if (!syncEnabled() || typeof window === 'undefined') return;
  void fetch(`/api/documents?type=${type}&id=${encodeURIComponent(id)}`, {
    method: 'DELETE',
  }).catch(() => null);
}

export type ServerDocumentsState = { resumes: unknown[]; coverLetters: unknown[] };

/** Hydrate the library from the server (server is the source of truth). */
export async function hydrateDocumentsFromServer(): Promise<'server' | 'offline'> {
  if (!syncEnabled()) return 'offline';
  const response = await fetch('/api/documents').catch(() => null);
  if (!response?.ok) return 'offline';
  const server = (await response.json()) as ServerDocumentsState;
  useProfileStore.setState({
    resumes: server.resumes as never,
    coverLetters: server.coverLetters as never,
  });
  return 'server';
}
