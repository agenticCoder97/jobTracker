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
  clearAppsState,
  listAppsState,
  upsertBundles,
} from '@/lib/repositories/supabase/apps-repository';
import { DEMO_USER_ID } from '@/lib/types';

const app = {
  id: 'a-1',
  ownerUserId: DEMO_USER_ID,
  displayId: 'JT-1',
  status: 'applied',
} as never;

describe('apps repository', () => {
  beforeEach(() => {
    upsertMock.mockClear();
    deleteEqMock.mockClear();
    selectEqMock.mockReset();
  });

  test('upsertBundles writes application, activity and docs rows', async () => {
    await upsertBundles([
      {
        application: app,
        activity: { comments: [], history: [], links: [], attachments: [] },
        docs: { applicationId: 'a-1', resumeId: 'r-1', coverLetterId: null, ats: {} as never },
      },
    ]);
    const tables = upsertMock.mock.calls.map((call) => call[0]);
    expect(tables).toContain('applications');
    expect(tables).toContain('application_activity');
    expect(tables).toContain('app_docs');
    const appRow = upsertMock.mock.calls.find((call) => call[0] === 'applications')![1][0];
    expect(appRow.owner_user_id).toBe(DEMO_USER_ID);
    expect(appRow.display_id).toBe('JT-1');
    expect(appRow.payload.status).toBe('applied');
  });

  test('upsertBundles skips activity/docs when absent', async () => {
    await upsertBundles([{ application: app }]);
    const tables = upsertMock.mock.calls.map((call) => call[0]);
    expect(tables).toEqual(['applications']);
  });

  test('listAppsState maps rows back to store shape', async () => {
    selectEqMock.mockImplementation((table: string) => {
      if (table === 'applications')
        return Promise.resolve({ data: [{ id: 'a-1', payload: app }], error: null });
      if (table === 'application_activity')
        return Promise.resolve({
          data: [
            {
              application_id: 'a-1',
              payload: { comments: [], history: [], links: [], attachments: [] },
            },
          ],
          error: null,
        });
      return Promise.resolve({ data: [], error: null });
    });
    const state = await listAppsState();
    expect(state.applications).toHaveLength(1);
    expect(state.activity['a-1']).toBeDefined();
    expect(state.appDocs).toEqual({});
  });

  test('clearAppsState deletes owner rows from all three tables', async () => {
    await clearAppsState();
    expect(deleteEqMock.mock.calls.map((call) => call[0]).sort()).toEqual([
      'app_docs',
      'application_activity',
      'applications',
    ]);
  });
});
