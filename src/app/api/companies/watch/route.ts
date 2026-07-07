import { NextResponse } from 'next/server';
import { z } from 'zod';

import {
  addWatchedCompany,
  removeWatchedCompany,
} from '@/lib/repositories/supabase/research-repository';
import { shouldUseSupabaseAdapter } from '@/lib/supabase/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({ companyKey: z.string().min(1).max(200) });

export async function POST(request: Request) {
  return mutate(request, addWatchedCompany);
}
export async function DELETE(request: Request) {
  return mutate(request, removeWatchedCompany);
}

async function mutate(request: Request, fn: (key: string) => Promise<void>) {
  if (!shouldUseSupabaseAdapter()) return NextResponse.json({ error: 'adapter disabled' }, { status: 501 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  try {
    await fn(parsed.data.companyKey);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 503 });
  }
}
