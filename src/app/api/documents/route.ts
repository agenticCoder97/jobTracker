import { NextResponse } from 'next/server';
import { z } from 'zod';

import {
  deleteDocument,
  listDocuments,
  upsertDocuments,
} from '@/lib/repositories/supabase/documents-repository';
import { shouldUseSupabaseAdapter } from '@/lib/supabase/env';
import type { CoverLetter, Resume } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const documentSchema = z.object({ id: z.string().min(1), updatedAt: z.string() }).passthrough();
const putSchema = z.object({
  resumes: z.array(documentSchema).max(100).optional(),
  coverLetters: z.array(documentSchema).max(100).optional(),
});

function adapterDisabled() {
  return NextResponse.json(
    { error: 'supabase adapter disabled - set NEXT_PUBLIC_PERSISTENCE_ADAPTER=supabase' },
    { status: 501 },
  );
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function GET() {
  if (!shouldUseSupabaseAdapter()) return adapterDisabled();
  try {
    return NextResponse.json(await listDocuments());
  } catch (error) {
    return NextResponse.json({ error: message(error) }, { status: 503 });
  }
}

export async function PUT(request: Request) {
  if (!shouldUseSupabaseAdapter()) return adapterDisabled();
  const body = await request.json().catch(() => null);
  const parsed = putSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid body', issues: parsed.error.issues },
      { status: 400 },
    );
  }
  try {
    await upsertDocuments({
      ...(parsed.data.resumes ? { resumes: parsed.data.resumes as unknown as Resume[] } : {}),
      ...(parsed.data.coverLetters
        ? { coverLetters: parsed.data.coverLetters as unknown as CoverLetter[] }
        : {}),
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: message(error) }, { status: 503 });
  }
}

export async function DELETE(request: Request) {
  if (!shouldUseSupabaseAdapter()) return adapterDisabled();
  const params = new URL(request.url).searchParams;
  const type = params.get('type');
  const id = params.get('id');
  if ((type !== 'resume' && type !== 'cover-letter') || !id) {
    return NextResponse.json({ error: 'invalid type or id' }, { status: 400 });
  }
  try {
    await deleteDocument(type, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: message(error) }, { status: 503 });
  }
}
