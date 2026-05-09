import { beforeEach, describe, expect, test } from 'vitest';
import { useAppsStore } from '@/lib/store/apps-store';
import { selectUnread, useNotificationsStore } from '@/lib/store/notifications-store';
import { useUiStore } from '@/lib/store/ui-store';

describe('stores', () => {
  beforeEach(() => {
    useAppsStore.getState().reset();
    useNotificationsStore.getState().reset();
    useUiStore.setState({ boardFilter: 'all', viewMode: 'board', toasts: [] });
  });

  test('moves an application and records history', () => {
    const app = useAppsStore.getState().applications.find((item) => item.displayId === 'JT-42');
    expect(app).toBeDefined();
    useAppsStore.getState().moveStatus(app!.id, 'applied');
    expect(useAppsStore.getState().applications.find((item) => item.id === app!.id)?.status).toBe(
      'applied',
    );
    expect(useAppsStore.getState().activity[app!.id]?.history[0]?.type).toBe('status');
  });

  test('adds comments and marks notifications read', () => {
    const app = useAppsStore.getState().applications[0]!;
    useAppsStore.getState().addComment(app.id, 'Follow up tomorrow');
    expect(useAppsStore.getState().activity[app.id]?.comments[0]?.text).toBe('Follow up tomorrow');

    expect(selectUnread(useNotificationsStore.getState()).length).toBe(5);
    useNotificationsStore.getState().markAllRead();
    expect(selectUnread(useNotificationsStore.getState()).length).toBe(0);
  });
});
