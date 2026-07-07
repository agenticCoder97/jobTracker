/**
 * Research-refresh cron.
 *
 * Schedule lives in `vercel.json`. The route is gated by `assertCronAuth`
 * so an unauthenticated visitor cannot kick a refresh manually. The actual
 * provider fan-out + upserts live in `runResearchRefresh()` (shared with the
 * manual `/api/research/run` trigger); this route only owns the `cron_runs`
 * bookkeeping around that call.
 */

import { NextResponse } from 'next/server';

import { assertCronAuth, CronAuthError } from '@/app/api/cron/_auth';
import { getEventLogRepository } from '@/lib/repositories/server';
import { runResearchRefresh, type ResearchRunSummary } from '@/lib/research/pipeline';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    assertCronAuth(request.headers);
  } catch (error) {
    if (error instanceof CronAuthError) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    throw error;
  }

  const startedAt = new Date().toISOString();
  let runId: string | undefined;

  try {
    const admin = getSupabaseAdminClient();
    const { data, error } = await admin
      .from('cron_runs')
      .insert({ job_id: 'research', started_at: startedAt, status: 'running' })
      .select('id')
      .single();
    if (error) throw error;
    runId = data?.id;
  } catch (error) {
    getEventLogRepository().appendLog({
      level: 'error',
      message: 'cron.research: failed to open cron_runs row',
      context: { error: serializeError(error) },
    });
  }

  let summary: ResearchRunSummary | undefined;
  let runError: string | undefined;
  try {
    summary = await runResearchRefresh();
  } catch (error) {
    runError = error instanceof Error ? error.message : String(error);
  }

  const itemsProcessed = summary?.jobsUpserted ?? 0;
  const failed = Boolean(runError) || (summary != null && summary.errors.length > 0 && summary.jobsUpserted === 0);
  const status: 'ok' | 'error' = failed ? 'error' : 'ok';
  const errorMessage =
    runError ?? (failed ? summary?.errors.map((e) => `${e.providerId}: ${e.error}`).join('; ') : undefined);

  const finishedAt = new Date().toISOString();
  if (runId) {
    try {
      const admin = getSupabaseAdminClient();
      await admin
        .from('cron_runs')
        .update({
          status,
          finished_at: finishedAt,
          items_processed: itemsProcessed,
          ...(errorMessage ? { error: errorMessage } : {}),
        })
        .eq('id', runId);
    } catch (error) {
      getEventLogRepository().appendLog({
        level: 'error',
        message: 'cron.research: failed to close cron_runs row',
        context: { runId, error: serializeError(error) },
      });
    }
  }

  return NextResponse.json({
    ok: !runError,
    job: 'research',
    startedAt,
    finishedAt,
    itemsProcessed,
    summary,
    ...(runError ? { error: runError } : {}),
  });
}

function serializeError(err: unknown): Record<string, unknown> {
  if (err instanceof Error) return { name: err.name, message: err.message };
  return { value: String(err) };
}
