'use client';

import { useCallback, useEffect, useState } from 'react';

const isSupabase = process.env.NEXT_PUBLIC_PERSISTENCE_ADAPTER === 'supabase';

/**
 * Optimistic bookmark toggle for a single company. In `local` mode the toggle
 * is UI-only (no network call) so the demo stays interactive without a
 * backend; in `supabase` mode it calls POST/DELETE `/api/companies/watch` and
 * reverts on failure.
 */
export function useCompanyWatch(
  companyKey: string,
  initialWatched: boolean,
): {
  watched: boolean;
  pending: boolean;
  toggle: () => Promise<boolean>;
} {
  const [watched, setWatched] = useState(initialWatched);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    setWatched(initialWatched);
  }, [companyKey, initialWatched]);

  const toggle = useCallback(async (): Promise<boolean> => {
    const next = !watched;
    setWatched(next);
    if (!isSupabase) return true;
    setPending(true);
    try {
      const res = await fetch('/api/companies/watch', {
        method: next ? 'POST' : 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyKey }),
      });
      if (!res.ok) throw new Error(`watch ${res.status}`);
      return true;
    } catch {
      setWatched(!next);
      return false;
    } finally {
      setPending(false);
    }
  }, [companyKey, watched]);

  return { watched, pending, toggle };
}
