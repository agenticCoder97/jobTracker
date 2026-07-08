/**
 * Server-only persistence for the document library (resumes + cover letters).
 * Same JSONB-first pattern as the apps repository: the whole store object is
 * the payload, keyed columns exist for lookups, all rows pinned to the owner.
 */

import 'server-only';

import { getOwnerUserId } from '@/lib/server/owner';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { RESUMES } from '@/lib/data/seed';
import type { CoverLetter, Resume } from '@/lib/types';

export type DocumentsState = {
  resumes: Resume[];
  coverLetters: CoverLetter[];
};

export type DocumentType = 'resume' | 'cover-letter';

const TABLE_BY_TYPE: Record<DocumentType, string> = {
  resume: 'resumes',
  'cover-letter': 'cover_letters',
};

type PayloadRow<T> = { payload: T };

export async function listDocuments(): Promise<DocumentsState> {
  const admin = getSupabaseAdminClient();
  const owner = getOwnerUserId();
  const [resumes, coverLetters] = await Promise.all([
    admin.from('resumes').select('id, payload').eq('owner_user_id', owner),
    admin.from('cover_letters').select('id, payload').eq('owner_user_id', owner),
  ]);
  for (const result of [resumes, coverLetters]) {
    if (result.error) throw new Error(`documents list failed: ${result.error.message}`);
  }
  return {
    resumes: withDefaultResume(
      ((resumes.data ?? []) as PayloadRow<Resume>[]).map((row) => row.payload),
    ),
    coverLetters: ((coverLetters.data ?? []) as PayloadRow<CoverLetter>[]).map(
      (row) => row.payload,
    ),
  };
}

function withDefaultResume(resumes: Resume[]): Resume[] {
  if (resumes.length > 0) return resumes;
  const defaultResume = RESUMES.find((resume) => resume.isDefault);
  return defaultResume ? [structuredClone(defaultResume)] : [];
}

export async function upsertDocuments(state: Partial<DocumentsState>): Promise<void> {
  const admin = getSupabaseAdminClient();
  const owner = getOwnerUserId();
  if (state.resumes && state.resumes.length > 0) {
    const rows = state.resumes.map((resume) => ({
      id: resume.id,
      owner_user_id: owner,
      payload: resume,
      updated_at: resume.updatedAt,
    }));
    const { error } = await admin.from('resumes').upsert(rows, { onConflict: 'id' });
    if (error) throw new Error(`resumes upsert failed: ${error.message}`);
  }
  if (state.coverLetters && state.coverLetters.length > 0) {
    const rows = state.coverLetters.map((coverLetter) => ({
      id: coverLetter.id,
      owner_user_id: owner,
      payload: coverLetter,
      updated_at: coverLetter.updatedAt,
    }));
    const { error } = await admin.from('cover_letters').upsert(rows, { onConflict: 'id' });
    if (error) throw new Error(`cover_letters upsert failed: ${error.message}`);
  }
}

export async function deleteDocument(type: DocumentType, id: string): Promise<void> {
  const admin = getSupabaseAdminClient();
  const { error } = await admin.from(TABLE_BY_TYPE[type]).delete().eq('id', id);
  if (error) throw new Error(`${TABLE_BY_TYPE[type]} delete failed: ${error.message}`);
}
