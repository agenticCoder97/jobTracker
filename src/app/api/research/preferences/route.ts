import { NextResponse } from 'next/server';
import { z } from 'zod';

import {
  getSearchPreferences,
  setSearchPreferences,
} from '@/lib/repositories/supabase/research-preferences-repository';
import { shouldUseSupabaseAdapter } from '@/lib/supabase/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const prefsSchema = z.object({
  keywords: z.array(z.string()).max(50).optional(),
  location: z.string().max(120).optional(),
  remote: z.enum(['remote', 'hybrid', 'onsite', 'any']).optional(),
});

export async function GET() {
  if (!shouldUseSupabaseAdapter()) return NextResponse.json({ error: 'adapter disabled' }, { status: 501 });
  try {
    return NextResponse.json({ preferences: await getSearchPreferences() });
  } catch (error) {
    return NextResponse.json({ error: msg(error) }, { status: 503 });
  }
}

export async function PUT(request: Request) {
  if (!shouldUseSupabaseAdapter()) return NextResponse.json({ error: 'adapter disabled' }, { status: 501 });
  const parsed = prefsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid body', issues: parsed.error.issues }, { status: 400 });
  }
  const { keywords, location, remote } = parsed.data;
  try {
    const preferences = await setSearchPreferences({
      ...(keywords !== undefined ? { keywords } : {}),
      ...(location !== undefined ? { location } : {}),
      ...(remote !== undefined ? { remote } : {}),
    });
    return NextResponse.json({ ok: true, preferences });
  } catch (error) {
    return NextResponse.json({ error: msg(error) }, { status: 503 });
  }
}

function msg(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
