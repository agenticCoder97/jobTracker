'use client';

import { useEffect, useState } from 'react';
import { DAILY_PICKS } from '@/lib/data/seed';
import type { DailyPick } from '@/lib/types';

const isSupabase = process.env.NEXT_PUBLIC_PERSISTENCE_ADAPTER === 'supabase';

export function useLivePicks(): {
  picks: DailyPick[];
  spotlight: DailyPick | null;
  loading: boolean;
  error: string | null;
} {
  const [picks, setPicks] = useState<DailyPick[]>(isSupabase ? [] : DAILY_PICKS);
  const [spotlight, setSpotlight] = useState<DailyPick | null>(
    isSupabase ? null : (DAILY_PICKS[0] ?? null),
  );
  const [loading, setLoading] = useState(isSupabase);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabase) return;
    let active = true;
    (async () => {
      try {
        const res = await fetch('/api/research/picks');
        if (!res.ok) throw new Error(`picks ${res.status}`);
        const body = (await res.json()) as { picks: DailyPick[]; spotlight: DailyPick | null };
        if (active) {
          setPicks(body.picks);
          setSpotlight(body.spotlight);
        }
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

  return { picks, spotlight, loading, error };
}
