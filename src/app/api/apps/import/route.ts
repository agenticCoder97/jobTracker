import { NextResponse } from 'next/server';
import { z } from 'zod';

import { listAppsState, upsertBundles } from '@/lib/repositories/supabase/apps-repository';
import { shouldUseSupabaseAdapter } from '@/lib/supabase/env';
import type { Activity, AppDocs, Application } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const importSchema = z.object({
  applications: z.array(z.object({ id: z.string().min(1) }).passthrough()).max(500),
  activity: z.record(z.string(), z.object({}).passthrough()),
  appDocs: z.record(z.string(), z.object({}).passthrough()),
});

/** One-time carry-over of the local board. Only allowed while the server board is empty. */
export async function POST(request: Request) {
  if (!shouldUseSupabaseAdapter()) {
    return NextResponse.json({ error: 'supabase adapter disabled' }, { status: 501 });
  }
  const body = await request.json().catch(() => null);
  const parsed = importSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid body', issues: parsed.error.issues },
      { status: 400 },
    );
  }
  try {
    const existing = await listAppsState();
    if (existing.applications.length > 0) {
      return NextResponse.json({ error: 'server board is not empty' }, { status: 409 });
    }
    const { applications, activity, appDocs } = parsed.data;
    await upsertBundles(
      applications.map((app) => {
        const id = app.id as string;
        const act = activity[id];
        const docs = appDocs[id];
        return {
          application: app as unknown as Application,
          ...(act ? { activity: act as unknown as Activity } : {}),
          ...(docs ? { docs: docs as unknown as AppDocs } : {}),
        };
      }),
    );
    return NextResponse.json({ ok: true, count: applications.length });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 503 },
    );
  }
}
