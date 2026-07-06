/**
 * Server-only persistence for the Home board: applications + activity + docs.
 * JSONB-first: each store object is stored whole in `payload`, keyed columns
 * exist only for lookups. All rows are pinned to the single owner user.
 */

import 'server-only';

import { getOwnerUserId } from '@/lib/server/owner';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import type { Activity, AppDocs, Application, Uuid } from '@/lib/types';

export type AppBundle = {
  application: Application;
  activity?: Activity;
  docs?: AppDocs;
};

export type AppsState = {
  applications: Application[];
  activity: Record<Uuid, Activity>;
  appDocs: Record<Uuid, AppDocs>;
};

type PayloadRow<T> = { payload: T };
type ActivityRow = { application_id: Uuid; payload: Activity };
type DocsRow = { application_id: Uuid; payload: AppDocs };

export async function listAppsState(): Promise<AppsState> {
  const admin = getSupabaseAdminClient();
  const owner = getOwnerUserId();

  const [apps, activity, docs] = await Promise.all([
    admin.from('applications').select('id, payload').eq('owner_user_id', owner),
    admin.from('application_activity').select('application_id, payload').eq('owner_user_id', owner),
    admin.from('app_docs').select('application_id, payload').eq('owner_user_id', owner),
  ]);
  for (const result of [apps, activity, docs]) {
    if (result.error) throw new Error(`apps-repository list failed: ${result.error.message}`);
  }

  return {
    applications: ((apps.data ?? []) as PayloadRow<Application>[]).map((row) => row.payload),
    activity: Object.fromEntries(
      ((activity.data ?? []) as ActivityRow[]).map((row) => [row.application_id, row.payload]),
    ),
    appDocs: Object.fromEntries(
      ((docs.data ?? []) as DocsRow[]).map((row) => [row.application_id, row.payload]),
    ),
  };
}

export async function upsertBundles(bundles: AppBundle[]): Promise<void> {
  if (bundles.length === 0) return;
  const admin = getSupabaseAdminClient();
  const owner = getOwnerUserId();

  const appRows = bundles.map(({ application }) => ({
    id: application.id,
    owner_user_id: owner,
    display_id: application.displayId,
    payload: application,
    updated_at: application.updatedAt,
    deleted_at: application.deletedAt,
  }));
  const { error: appError } = await admin.from('applications').upsert(appRows, {
    onConflict: 'id',
  });
  if (appError) throw new Error(`applications upsert failed: ${appError.message}`);

  const activityRows = bundles
    .filter((bundle) => bundle.activity)
    .map((bundle) => ({
      application_id: bundle.application.id,
      owner_user_id: owner,
      payload: bundle.activity,
      updated_at: new Date().toISOString(),
    }));
  if (activityRows.length > 0) {
    const { error } = await admin.from('application_activity').upsert(activityRows, {
      onConflict: 'application_id',
    });
    if (error) throw new Error(`application_activity upsert failed: ${error.message}`);
  }

  const docRows = bundles
    .filter((bundle) => bundle.docs)
    .map((bundle) => ({
      application_id: bundle.application.id,
      owner_user_id: owner,
      payload: bundle.docs,
      updated_at: new Date().toISOString(),
    }));
  if (docRows.length > 0) {
    const { error } = await admin.from('app_docs').upsert(docRows, {
      onConflict: 'owner_user_id,application_id',
    });
    if (error) throw new Error(`app_docs upsert failed: ${error.message}`);
  }
}

export async function clearAppsState(): Promise<void> {
  const admin = getSupabaseAdminClient();
  const owner = getOwnerUserId();
  // Children first; FK cascade also covers this, but explicit clears are easier to verify.
  for (const table of ['app_docs', 'application_activity', 'applications'] as const) {
    const { error } = await admin.from(table).delete().eq('owner_user_id', owner);
    if (error) throw new Error(`${table} clear failed: ${error.message}`);
  }
}
