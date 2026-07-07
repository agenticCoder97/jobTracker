import { NextResponse } from 'next/server';

import { getSearchPreferences } from '@/lib/repositories/supabase/research-preferences-repository';
import { listExternalJobs } from '@/lib/repositories/supabase/research-repository';
import { preferenceKeywords } from '@/lib/research/preferences';
import { toJobListing } from '@/lib/research/to-job-listing';
import { shouldUseSupabaseAdapter } from '@/lib/supabase/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  if (!shouldUseSupabaseAdapter()) {
    return NextResponse.json(
      { error: 'supabase adapter disabled - set NEXT_PUBLIC_PERSISTENCE_ADAPTER=supabase' },
      { status: 501 },
    );
  }
  try {
    const [jobs, prefs] = await Promise.all([listExternalJobs(), getSearchPreferences()]);
    const keywords = preferenceKeywords(prefs, []);
    const listings = jobs.map((job) => toJobListing(job, keywords));
    return NextResponse.json({ listings });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 503 },
    );
  }
}
