import { NextResponse } from 'next/server';

import { getSearchPreferences } from '@/lib/repositories/supabase/research-preferences-repository';
import {
  listDismissedPickIds,
  listExternalJobs,
} from '@/lib/repositories/supabase/research-repository';
import { computeMatchScore } from '@/lib/research/match-score';
import { DEFAULT_MATCH_PROFILE, preferenceKeywords } from '@/lib/research/preferences';
import { externalJobKey } from '@/lib/research/to-job-listing';
import { toDailyPick } from '@/lib/research/to-daily-pick';
import { shouldUseSupabaseAdapter } from '@/lib/supabase/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PICK_LIMIT = 8;

export async function GET() {
  if (!shouldUseSupabaseAdapter()) {
    return NextResponse.json({ error: 'supabase adapter disabled' }, { status: 501 });
  }
  try {
    const [jobs, prefs, dismissed] = await Promise.all([
      listExternalJobs(),
      getSearchPreferences(),
      listDismissedPickIds(),
    ]);
    const keywords = preferenceKeywords(prefs, []);
    const dismissedSet = new Set(dismissed);
    const picks = jobs
      .filter((job) => !dismissedSet.has(externalJobKey(job)))
      .map((job) => ({ job, score: computeMatchScore(job, keywords, DEFAULT_MATCH_PROFILE) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, PICK_LIMIT)
      .map(({ job, score }) => toDailyPick(job, score));
    return NextResponse.json({ picks, spotlight: picks[0] ?? null });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 503 },
    );
  }
}
