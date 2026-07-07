'use client';

import { useEffect, useState } from 'react';
import { COMPANIES } from '@/lib/data/seed';
import type { Company } from '@/lib/types';

export type LiveCompany = Company & { openRoles: number; watched: boolean };

const isSupabase = process.env.NEXT_PUBLIC_PERSISTENCE_ADAPTER === 'supabase';

const FALLBACK_COMPANIES: LiveCompany[] = Object.values(COMPANIES).map((company) => ({
  ...company,
  openRoles: 0,
  watched: false,
}));

export function useLiveCompanies(): {
  companies: LiveCompany[];
  loading: boolean;
  error: string | null;
} {
  const [companies, setCompanies] = useState<LiveCompany[]>(
    isSupabase ? [] : FALLBACK_COMPANIES,
  );
  const [loading, setLoading] = useState(isSupabase);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabase) return;
    let active = true;
    (async () => {
      try {
        const res = await fetch('/api/companies');
        if (!res.ok) throw new Error(`companies ${res.status}`);
        const body = (await res.json()) as { companies: LiveCompany[] };
        if (active) setCompanies(body.companies);
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

  return { companies, loading, error };
}
