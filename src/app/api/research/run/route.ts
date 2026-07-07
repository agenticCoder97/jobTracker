import { NextResponse } from 'next/server';

import { runResearchRefresh } from '@/lib/research/pipeline';
import { shouldUseSupabaseAdapter } from '@/lib/supabase/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  if (!shouldUseSupabaseAdapter()) {
    return NextResponse.json(
      { error: 'supabase adapter disabled - set NEXT_PUBLIC_PERSISTENCE_ADAPTER=supabase' },
      { status: 501 },
    );
  }
  try {
    const summary = await runResearchRefresh();
    return NextResponse.json({ ok: true, ...summary });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 503 },
    );
  }
}
