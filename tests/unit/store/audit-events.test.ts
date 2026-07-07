import { beforeEach, describe, expect, test } from 'vitest';
import { eventLog } from '@/lib/repositories';
import { useAppsStore } from '@/lib/store/apps-store';
import { useNotificationsStore } from '@/lib/store/notifications-store';
import { useProfileStore } from '@/lib/store/profile-store';

beforeEach(() => {
  eventLog.reset();
  useAppsStore.getState().reset();
  useProfileStore.getState().reset();
  useNotificationsStore.getState().reset();
  // The reset() above also writes audit events; clear them
  eventLog.reset();
});

describe('audit events from store actions', () => {
  test('createCard appends a created audit event', () => {
    const card = useAppsStore
      .getState()
      .createCard({ status: 'wishlist', companyName: 'New company', role: 'New application' });
    const events = eventLog.listAudit({ entityId: card.id });
    expect(events.some((e) => e.event === 'created' && e.entityType === 'application')).toBe(true);
  });

  test('moveStatus appends a status_changed audit event', () => {
    const apps = useAppsStore.getState().applications;
    const subject = apps[0];
    expect(subject).toBeDefined();
    useAppsStore.getState().moveStatus(subject!.id, 'interview');
    const events = eventLog.listAudit({ entityId: subject!.id });
    expect(events.some((e) => e.event === 'status_changed')).toBe(true);
  });

  test('addToWishlist appends a wishlist_added audit event', () => {
    const listing = useAppsStore.getState().applications[0];
    expect(listing).toBeDefined();
    // Use a daily pick; create one through the store helper using its own daily pick
    const { addToWishlist } = useAppsStore.getState();
    const pick = {
      id: 'pick-id-1',
      company: 'stripe',
      role: 'Test pick',
      location: 'Remote',
      salary: '$200K',
      match: 90,
      why: ['speed', 'remote'],
      posted: '2026-05-01',
      applicants: '23',
    };
    const created = addToWishlist(pick, 'Research');
    const events = eventLog.listAudit({ entityId: created.id });
    expect(events.some((e) => e.event === 'wishlist_added')).toBe(true);
  });

  test('updateAbout appends a profile audit event', () => {
    const profileId = useProfileStore.getState().profile.id;
    useProfileStore.getState().updateAbout('Updated about text for audit test.');
    const events = eventLog.listAudit({ entityType: 'profile', entityId: profileId });
    expect(events.some((e) => e.event === 'about_changed')).toBe(true);
  });

  test('notifications.dismiss appends a dismissed audit event', () => {
    const notif = useNotificationsStore.getState().notifications[0];
    expect(notif).toBeDefined();
    useNotificationsStore.getState().dismiss(notif!.id);
    const events = eventLog.listAudit({ entityType: 'notification', entityId: notif!.id });
    expect(events.some((e) => e.event === 'dismissed')).toBe(true);
  });

  test('reset appends a demo reset audit event', () => {
    useAppsStore.getState().reset();
    const events = eventLog.listAudit({ entityType: 'demo' });
    expect(events.some((e) => e.event === 'reset' && e.entityId === 'apps')).toBe(true);
  });

  test('audit events carry entityType, entityId, event, createdAt, ownerUserId', () => {
    useAppsStore
      .getState()
      .createCard({ status: 'wishlist', companyName: 'New company', role: 'New application' });
    const event = eventLog.listAudit().at(-1);
    expect(event).toBeDefined();
    expect(event!.entityType).toBeTruthy();
    expect(event!.entityId).toBeTruthy();
    expect(event!.event).toBeTruthy();
    expect(event!.createdAt).toBeTruthy();
    expect(event!.ownerUserId).toBeTruthy();
  });
});
