import { NextResponse } from 'next/server';
import { z } from 'zod';

import {
  clearAppsState,
  listAppsState,
  upsertBundles,
} from '@/lib/repositories/supabase/apps-repository';
import { shouldUseSupabaseAdapter } from '@/lib/supabase/env';
import type { Activity, AppDocs, Application } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Payloads are validated structurally (JSONB-first design): check the identity
 * fields the DB keys on and pass the rest through as payload.
 */
const bundleSchema = z.object({
  application: z
    .object({
      id: z.string().min(1),
      displayId: z.string().min(1),
      updatedAt: z.string(),
    })
    .passthrough(),
  activity: z.object({}).passthrough().optional(),
  docs: z.object({}).passthrough().optional(),
});

const putSchema = z.object({ bundles: z.array(bundleSchema).min(1).max(200) });

function adapterDisabled() {
  return NextResponse.json(
    { error: 'supabase adapter disabled - set NEXT_PUBLIC_PERSISTENCE_ADAPTER=supabase' },
    { status: 501 },
  );
}

export async function GET() {
  if (!shouldUseSupabaseAdapter()) return adapterDisabled();
  try {
    const state = await listAppsState();
    return NextResponse.json(state);
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
    await upsertBundles(
      parsed.data.bundles.map((bundle) => ({
        application: bundle.application as unknown as Application,
        ...(bundle.activity ? { activity: bundle.activity as unknown as Activity } : {}),
        ...(bundle.docs ? { docs: bundle.docs as unknown as AppDocs } : {}),
      })),
    );
    return NextResponse.json({ ok: true, count: parsed.data.bundles.length });
  } catch (error) {
    return NextResponse.json({ error: message(error) }, { status: 503 });
  }
}

export async function DELETE() {
  if (!shouldUseSupabaseAdapter()) return adapterDisabled();
  try {
    await clearAppsState();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: message(error) }, { status: 503 });
  }
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
