'use client';

import { useCallback, useEffect, useState } from 'react';
import { JOB_LISTINGS } from '@/lib/data/seed';
import type { JobListingWithDetails } from '@/lib/research/to-job-listing';

const isSupabase = process.env.NEXT_PUBLIC_PERSISTENCE_ADAPTER === 'supabase';

export function useLiveListings(): {
  listings: JobListingWithDetails[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
} {
  const [listings, setListings] = useState<JobListingWithDetails[]>(
    isSupabase ? [] : JOB_LISTINGS,
  );
  const [loading, setLoading] = useState(isSupabase);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    if (!isSupabase) return;
    let active = true;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const res = await fetch('/api/jobs/listings');
        if (!res.ok) throw new Error(`listings ${res.status}`);
        const body = (await res.json()) as { listings: JobListingWithDetails[] };
        if (active) setListings(body.listings);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [reloadToken]);

  const refetch = useCallback(() => {
    if (!isSupabase) return;
    setReloadToken((token) => token + 1);
  }, []);

  return { listings, loading, error, refetch };
}
