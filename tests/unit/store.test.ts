import { beforeEach, describe, expect, test } from 'vitest';
import { useAppsStore } from '@/lib/store/apps-store';
import { selectUnread, useNotificationsStore } from '@/lib/store/notifications-store';
import { useUiStore } from '@/lib/store/ui-store';
import { filterApplications } from '@/components/jobtracker/JobTrackerApp';

describe('stores', () => {
  beforeEach(() => {
    useAppsStore.getState().reset();
    useNotificationsStore.getState().reset();
    useUiStore.setState({
      boardFilter: 'all',
      boardCompanyFilter: 'all',
      boardLocationFilter: 'all',
      boardTagFilter: 'all',
      boardSortMode: 'lastActivity',
      viewMode: 'board',
      toasts: [],
    });
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

  test('board field filters narrow applications by company, location, and tag', () => {
    const applications = useAppsStore.getState().applications;

    const stripe = filterApplications(applications, 'all', {
      company: 'stripe',
      location: 'all',
      tag: 'all',
    });
    expect(stripe.length).toBeGreaterThan(0);
    expect(stripe.every((app) => app.company === 'stripe')).toBe(true);

    const remote = filterApplications(applications, 'all', {
      company: 'all',
      location: 'Remote (US)',
      tag: 'all',
    });
    expect(remote.length).toBeGreaterThan(0);
    expect(remote.every((app) => app.location === 'Remote (US)')).toBe(true);

    const ai = filterApplications(applications, 'all', {
      company: 'all',
      location: 'all',
      tag: 'AI',
    });
    expect(ai.length).toBeGreaterThan(0);
    expect(ai.every((app) => app.tags.includes('AI'))).toBe(true);
  });
});
