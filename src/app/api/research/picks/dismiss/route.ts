import { NextResponse } from 'next/server';
import { z } from 'zod';

import { dismissPick } from '@/lib/repositories/supabase/research-repository';
import { shouldUseSupabaseAdapter } from '@/lib/supabase/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({ jobKey: z.string().min(1).max(200) });

export async function POST(request: Request) {
  if (!shouldUseSupabaseAdapter()) return NextResponse.json({ error: 'adapter disabled' }, { status: 501 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  try {
    await dismissPick(parsed.data.jobKey);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 503 });
  }
}
