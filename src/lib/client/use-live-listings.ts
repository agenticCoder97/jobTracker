'use client';

import { useEffect, useState } from 'react';
import { JOB_LISTINGS } from '@/lib/data/seed';
import type { JobListing } from '@/lib/types';

const isSupabase = process.env.NEXT_PUBLIC_PERSISTENCE_ADAPTER === 'supabase';

export function useLiveListings(): {
  listings: JobListing[];
  loading: boolean;
  error: string | null;
} {
  const [listings, setListings] = useState<JobListing[]>(isSupabase ? [] : JOB_LISTINGS);
  const [loading, setLoading] = useState(isSupabase);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabase) return;
    let active = true;
    (async () => {
      try {
        const res = await fetch('/api/jobs/listings');
        if (!res.ok) throw new Error(`listings ${res.status}`);
        const body = (await res.json()) as { listings: JobListing[] };
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
  }, []);

  return { listings, loading, error };
}
