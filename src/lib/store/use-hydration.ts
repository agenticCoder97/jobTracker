'use client';

import { useEffect, useState } from 'react';
import { hydrateFromServer } from '@/lib/store/apps-sync';
import { hydrateDocumentsFromServer } from '@/lib/store/docs-sync';
import { useAppsStore } from '@/lib/store/apps-store';
import { useNotificationsStore } from '@/lib/store/notifications-store';
import { useProfileStore } from '@/lib/store/profile-store';
import { useUiStore } from '@/lib/store/ui-store';

let hydrationPromise: Promise<void> | null = null;
let hydrationComplete = false;

function startHydration(): Promise<void> {
  if (!hydrationPromise) {
    hydrationPromise = Promise.all([
      useAppsStore.persist.rehydrate(),
      useProfileStore.persist.rehydrate(),
      useNotificationsStore.persist.rehydrate(),
    ])
      .then(async () => {
        const [outcome] = await Promise.all([hydrateFromServer(), hydrateDocumentsFromServer()]);
        if (outcome === 'offline' && process.env.NEXT_PUBLIC_PERSISTENCE_ADAPTER === 'supabase') {
          useUiStore.getState().pushToast({
            kind: 'error',
            message: 'Could not reach the server - showing locally saved data.',
          });
        }
      })
      .finally(() => {
        hydrationComplete = true;
      });
  }
  return hydrationPromise;
}

export function useHydration(): boolean {
  const [hydrated, setHydrated] = useState(hydrationComplete);

  useEffect(() => {
    if (hydrationComplete) {
      setHydrated(true);
      return;
    }
    let cancelled = false;
    void startHydration().finally(() => {
      if (!cancelled) setHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return hydrated;
}
