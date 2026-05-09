/**
 * Research-refresh cron — TEMPLATE.
 *
 * Schedule lives in `vercel.json`. The route is gated by `assertCronAuth`
 * so an unauthenticated visitor cannot kick a refresh manually.
 *
 * Phase 0 (this pass): the route compiles, authenticates, opens/closes a
 * `cron_runs` row, and returns a stub summary. The actual provider
 * fan-out + research_results writes are deferred to phase 2.
 */

import { NextResponse } from 'next/server';

import { assertCronAuth, CronAuthError } from '@/app/api/cron/_auth';
import { listJobProviders } from '@/lib/api/registry';
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

  // TODO(phase 2): for each enabled research_subscription, fan out across
  // listJobProviders(), normalise into external_jobs, score against profile,
  // write research_results, log every call into api_call_log. Notifications
  // for new high-match items go through the existing eventLog/notifications
  // pipelines.
  const providerCount = listJobProviders().length;
  const itemsProcessed = 0;

  const finishedAt = new Date().toISOString();
  if (runId) {
    try {
      const admin = getSupabaseAdminClient();
      await admin
        .from('cron_runs')
        .update({
          status: 'ok',
          finished_at: finishedAt,
          items_processed: itemsProcessed,
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
    ok: true,
    job: 'research',
    startedAt,
    finishedAt,
    providerCount,
    itemsProcessed,
    note: 'template only — provider fan-out is not implemented yet',
  });
}

function serializeError(err: unknown): Record<string, unknown> {
  if (err instanceof Error) return { name: err.name, message: err.message };
  return { value: String(err) };
}
