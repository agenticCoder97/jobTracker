import { NextResponse } from 'next/server';

import { assertCronAuth, CronAuthError } from '@/app/api/cron/_auth';
import { processOutlookRejections } from '@/lib/outlook/rejections';
import { getEventLogRepository } from '@/lib/repositories/server';
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
    const { data, error } = await getSupabaseAdminClient()
      .from('cron_runs')
      .insert({ job_id: 'outlook-rejections', started_at: startedAt, status: 'running' })
      .select('id')
      .single();
    if (error) throw error;
    runId = data?.id;
  } catch (error) {
    getEventLogRepository().appendLog({
      level: 'error',
      message: 'cron.outlook-rejections: failed to open cron_runs row',
      context: { error: serializeError(error) },
    });
  }

  let summary: Awaited<ReturnType<typeof processOutlookRejections>> | undefined;
  let runError: string | undefined;
  try {
    summary = await processOutlookRejections();
  } catch (error) {
    runError = error instanceof Error ? error.message : String(error);
  }

  const finishedAt = new Date().toISOString();
  if (runId) {
    try {
      await getSupabaseAdminClient()
        .from('cron_runs')
        .update({
          status: runError ? 'error' : 'ok',
          finished_at: finishedAt,
          items_processed: summary?.updated ?? 0,
          ...(runError ? { error: runError } : {}),
        })
        .eq('id', runId);
    } catch (error) {
      getEventLogRepository().appendLog({
        level: 'error',
        message: 'cron.outlook-rejections: failed to close cron_runs row',
        context: { runId, error: serializeError(error) },
      });
    }
  }

  return NextResponse.json({
    ok: !runError,
    job: 'outlook-rejections',
    startedAt,
    finishedAt,
    summary,
    ...(runError ? { error: runError } : {}),
  });
}

function serializeError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) return { name: error.name, message: error.message };
  return { value: String(error) };
}
