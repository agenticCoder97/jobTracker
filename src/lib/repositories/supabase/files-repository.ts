/**
 * Server-only Supabase Storage access for uploaded files (card attachments,
 * resumes, cover letters). One private bucket; the client only ever sees
 * short-lived signed URLs minted here.
 */

import 'server-only';

import { getSupabaseAdminClient } from '@/lib/supabase/admin';

export const FILES_BUCKET = 'jobtracker-files';

export async function uploadStoredFile(
  path: string,
  bytes: ArrayBuffer,
  contentType: string,
): Promise<void> {
  const admin = getSupabaseAdminClient();
  const { error } = await admin.storage
    .from(FILES_BUCKET)
    .upload(path, bytes, { contentType, upsert: false });
  if (error) throw new Error(`file upload failed: ${error.message}`);
}

export async function signedUrlFor(path: string, expiresInSeconds = 300): Promise<string> {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin.storage
    .from(FILES_BUCKET)
    .createSignedUrl(path, expiresInSeconds);
  if (error || !data?.signedUrl) {
    throw new Error(`signed url failed: ${error?.message ?? 'no url returned'}`);
  }
  return data.signedUrl;
}

export async function removeStoredFile(path: string): Promise<void> {
  const admin = getSupabaseAdminClient();
  const { error } = await admin.storage.from(FILES_BUCKET).remove([path]);
  if (error) throw new Error(`file remove failed: ${error.message}`);
}
