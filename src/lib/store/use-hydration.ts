'use client';

import { useEffect, useState } from 'react';
import { useAppsStore } from '@/lib/store/apps-store';
import { useNotificationsStore } from '@/lib/store/notifications-store';
import { useProfileStore } from '@/lib/store/profile-store';

export function useHydration(): boolean {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    void Promise.all([
      useAppsStore.persist.rehydrate(),
      useProfileStore.persist.rehydrate(),
      useNotificationsStore.persist.rehydrate(),
    ]).finally(() => setHydrated(true));
  }, []);

  return hydrated;
}
