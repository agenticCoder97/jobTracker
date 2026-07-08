import { NextResponse } from 'next/server';
import { z } from 'zod';

import type { SignedImportCandidate } from '@/lib/outlook/candidate-signing';
import { importOutlookCandidates } from '@/lib/outlook/import';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  candidates: z
    .array(z.object({ payload: z.object({}).passthrough(), signature: z.string() }))
    .max(200),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid body', issues: parsed.error.issues },
      { status: 400 },
    );
  }
  try {
    const result = await importOutlookCandidates(
      parsed.data.candidates as unknown as SignedImportCandidate[],
    );
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 400 },
    );
  }
}
