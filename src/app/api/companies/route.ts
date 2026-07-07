import { NextResponse } from 'next/server';

import {
  listExternalCompanies,
  listExternalJobs,
  listWatchedCompanyKeys,
} from '@/lib/repositories/supabase/research-repository';
import { companySlug } from '@/lib/research/derive-companies';
import { toCompany } from '@/lib/research/to-company';
import { shouldUseSupabaseAdapter } from '@/lib/supabase/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  if (!shouldUseSupabaseAdapter()) {
    return NextResponse.json({ error: 'supabase adapter disabled' }, { status: 501 });
  }
  try {
    const [companies, jobs, watchedKeys] = await Promise.all([
      listExternalCompanies(),
      listExternalJobs(),
      listWatchedCompanyKeys(),
    ]);
    const openRoles = new Map<string, number>();
    for (const job of jobs) {
      const key = companySlug(job.companyName);
      openRoles.set(key, (openRoles.get(key) ?? 0) + 1);
    }
    const watched = new Set(watchedKeys);
    const rows = companies.map((c) =>
      toCompany(c, { openRoles: openRoles.get(c.sourceId) ?? 0, watched: watched.has(c.sourceId) }),
    );
    return NextResponse.json({ companies: rows });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 503 },
    );
  }
}
