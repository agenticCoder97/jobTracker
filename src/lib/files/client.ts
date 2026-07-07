'use client';

/**
 * Adapter-aware client file handling. Supabase mode round-trips through
 * /api/files (private bucket + signed URLs); local/demo mode inlines small
 * files as data URLs so everything persists inside localStorage.
 */

import { fileKindOf, formatBytes } from '@/lib/files/kind';
import type { Attachment } from '@/lib/types';

const LOCAL_MAX_BYTES = 2 * 1024 * 1024;

export type StoredFile = {
  name: string;
  size: string;
  kind: Attachment['kind'];
  storagePath?: string;
  dataUrl?: string;
};

export type FileScope = 'attachment' | 'resume' | 'cover-letter';

function supabaseMode(): boolean {
  return process.env.NEXT_PUBLIC_PERSISTENCE_ADAPTER === 'supabase';
}

export async function storeFile(
  file: File,
  scope: FileScope,
  applicationId?: string,
): Promise<StoredFile> {
  const base = { name: file.name, size: formatBytes(file.size), kind: fileKindOf(file.name) };
  if (supabaseMode()) {
    const form = new FormData();
    form.set('file', file);
    form.set('scope', scope);
    if (applicationId) form.set('applicationId', applicationId);
    const response = await fetch('/api/files', { method: 'POST', body: form });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(body?.error ?? `Upload failed (${response.status})`);
    }
    const { path } = (await response.json()) as { path: string };
    return { ...base, storagePath: path };
  }
  if (file.size > LOCAL_MAX_BYTES) {
    throw new Error('File is larger than 2 MB - demo mode stores files in the browser.');
  }
  return { ...base, dataUrl: await readAsDataUrl(file) };
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.readAsDataURL(file);
  });
}

/** Open a stored file in a new tab (signed URL or local blob). */
export async function openStoredFile(stored: {
  storagePath?: string;
  dataUrl?: string;
}): Promise<void> {
  if (stored.dataUrl) {
    const blob = await (await fetch(stored.dataUrl)).blob();
    window.open(URL.createObjectURL(blob), '_blank', 'noopener');
    return;
  }
  if (!stored.storagePath) throw new Error('No stored file for this item.');
  const response = await fetch(`/api/files?path=${encodeURIComponent(stored.storagePath)}`);
  if (!response.ok) throw new Error('Could not get a download link.');
  const { url } = (await response.json()) as { url: string };
  window.open(url, '_blank', 'noopener');
}

/** Best-effort server-side delete; local data URLs vanish with their record. */
export async function deleteStoredFile(stored: { storagePath?: string }): Promise<void> {
  if (!stored.storagePath || !supabaseMode()) return;
  await fetch(`/api/files?path=${encodeURIComponent(stored.storagePath)}`, {
    method: 'DELETE',
  }).catch(() => null);
}
