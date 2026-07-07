'use client';

import { useEffect, useState } from 'react';
import { hydrateFromServer } from '@/lib/store/apps-sync';
import { useAppsStore } from '@/lib/store/apps-store';
import { useNotificationsStore } from '@/lib/store/notifications-store';
import { useProfileStore } from '@/lib/store/profile-store';
import { useUiStore } from '@/lib/store/ui-store';

export function useHydration(): boolean {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      useAppsStore.persist.rehydrate(),
      useProfileStore.persist.rehydrate(),
      useNotificationsStore.persist.rehydrate(),
    ])
      .then(async () => {
        const outcome = await hydrateFromServer();
        if (outcome === 'offline' && process.env.NEXT_PUBLIC_PERSISTENCE_ADAPTER === 'supabase') {
          useUiStore.getState().pushToast({
            kind: 'error',
            message: 'Could not reach the server - showing locally saved data.',
          });
        }
      })
      .finally(() => {
        if (!cancelled) setHydrated(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return hydrated;
}
