import { beforeEach, describe, expect, test, vi } from 'vitest';

const upsertMock = vi.fn().mockResolvedValue({ error: null });
const deleteEqMock = vi.fn().mockResolvedValue({ error: null });
const selectEqMock = vi.fn();

vi.mock('@/lib/supabase/admin', () => ({
  getSupabaseAdminClient: () => ({
    from: (table: string) => ({
      upsert: (rows: unknown, opts?: unknown) => upsertMock(table, rows, opts),
      select: () => ({ eq: (col: string, val: string) => selectEqMock(table, col, val) }),
      delete: () => ({ eq: (col: string, val: string) => deleteEqMock(table, col, val) }),
    }),
  }),
}));

import {
  deleteDocument,
  listDocuments,
  upsertDocuments,
} from '@/lib/repositories/supabase/documents-repository';
import { DEMO_USER_ID } from '@/lib/types';

const resume = { id: 'r-1', ownerUserId: DEMO_USER_ID, name: 'CV', updatedAt: 'now' };

describe('documents repository', () => {
  beforeEach(() => {
    upsertMock.mockClear();
    deleteEqMock.mockClear();
    selectEqMock.mockReset();
  });

  test('upsertDocuments writes resume and cover letter rows', async () => {
    await upsertDocuments({
      resumes: [resume as never],
      coverLetters: [{ ...resume, id: 'c-1' } as never],
    });
    const tables = upsertMock.mock.calls.map((call) => call[0]);
    expect(tables).toEqual(['resumes', 'cover_letters']);
    const row = upsertMock.mock.calls[0]![1][0];
    expect(row.owner_user_id).toBe(DEMO_USER_ID);
    expect(row.payload.name).toBe('CV');
  });

  test('upsertDocuments skips empty arrays', async () => {
    await upsertDocuments({ resumes: [] });
    expect(upsertMock).not.toHaveBeenCalled();
  });

  test('listDocuments maps payload rows back', async () => {
    selectEqMock.mockImplementation((table: string) =>
      Promise.resolve({
        data: table === 'resumes' ? [{ id: 'r-1', payload: resume }] : [],
        error: null,
      }),
    );
    const state = await listDocuments();
    expect(state.resumes).toHaveLength(1);
    expect(state.coverLetters).toEqual([]);
  });

  test('deleteDocument targets the right table', async () => {
    await deleteDocument('resume', 'r-1');
    expect(deleteEqMock).toHaveBeenCalledWith('resumes', 'id', 'r-1');
    await deleteDocument('cover-letter', 'c-1');
    expect(deleteEqMock).toHaveBeenCalledWith('cover_letters', 'id', 'c-1');
  });
});
