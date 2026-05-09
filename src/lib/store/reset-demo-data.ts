'use client';

import { useAppsStore } from '@/lib/store/apps-store';
import { useNotificationsStore } from '@/lib/store/notifications-store';
import { useProfileStore } from '@/lib/store/profile-store';

export function resetDemoData(): void {
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith('jobtracker:')) localStorage.removeItem(key);
  }
  useAppsStore.persist.clearStorage();
  useProfileStore.persist.clearStorage();
  useNotificationsStore.persist.clearStorage();
  useAppsStore.getState().reset();
  useProfileStore.getState().reset();
  useNotificationsStore.getState().reset();
}
