import { beforeEach, describe, expect, test } from 'vitest';
import { useAppsStore } from '@/lib/store/apps-store';

describe('archive and delete', () => {
  beforeEach(() => {
    useAppsStore.getState().reset();
  });

  test('archiveApp sets archivedAt and unarchives on second call', () => {
    const app = useAppsStore.getState().applications[0]!;
    useAppsStore.getState().archiveApp(app.id);
    expect(
      useAppsStore.getState().applications.find((a) => a.id === app.id)?.archivedAt,
    ).toBeTruthy();
    useAppsStore.getState().archiveApp(app.id);
    expect(
      useAppsStore.getState().applications.find((a) => a.id === app.id)?.archivedAt,
    ).toBeNull();
  });

  test('deleteApp soft-deletes', () => {
    const app = useAppsStore.getState().applications[0]!;
    useAppsStore.getState().deleteApp(app.id);
    const stored = useAppsStore.getState().applications.find((a) => a.id === app.id);
    expect(stored?.deletedAt).toBeTruthy();
  });
});
