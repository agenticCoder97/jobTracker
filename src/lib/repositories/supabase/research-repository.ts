import 'server-only';

import type { ExternalCompany, ExternalJob } from '@/lib/api/types';
import { getOwnerUserId } from '@/lib/server/owner';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';

type StoredJobRow = { payload: ExternalJob; fetched_at: string };
type StoredCompanyRow = { payload: ExternalCompany; fetched_at: string };

export async function upsertExternalJobs(jobs: ExternalJob[]): Promise<void> {
  if (jobs.length === 0) return;
  const admin = getSupabaseAdminClient();
  const now = new Date().toISOString();
  const rows = jobs.map((job) => ({
    source_provider: job.sourceProvider,
    source_id: job.sourceId,
    payload: job,
    fetched_at: now,
  }));
  const { error } = await admin
    .from('external_jobs')
    .upsert(rows, { onConflict: 'source_provider,source_id' });
  if (error) throw new Error(`external_jobs upsert failed: ${error.message}`);
}

export async function upsertExternalCompanies(companies: ExternalCompany[]): Promise<void> {
  if (companies.length === 0) return;
  const admin = getSupabaseAdminClient();
  const now = new Date().toISOString();
  const rows = companies.map((company) => ({
    source_provider: company.sourceProvider,
    source_id: company.sourceId,
    payload: company,
    fetched_at: now,
  }));
  const { error } = await admin
    .from('external_companies')
    .upsert(rows, { onConflict: 'source_provider,source_id' });
  if (error) throw new Error(`external_companies upsert failed: ${error.message}`);
}

export async function listExternalJobs(limit = 200): Promise<ExternalJob[]> {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from('external_jobs')
    .select('payload, fetched_at')
    .order('fetched_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(`external_jobs list failed: ${error.message}`);
  return ((data ?? []) as StoredJobRow[]).map((row) => row.payload);
}

export async function listExternalCompanies(limit = 500): Promise<ExternalCompany[]> {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from('external_companies')
    .select('payload, fetched_at')
    .order('fetched_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(`external_companies list failed: ${error.message}`);
  return ((data ?? []) as StoredCompanyRow[]).map((row) => row.payload);
}

export async function listWatchedCompanyKeys(): Promise<string[]> {
  const admin = getSupabaseAdminClient();
  const owner = getOwnerUserId();
  const { data, error } = await admin
    .from('watched_companies')
    .select('company_key')
    .eq('owner_user_id', owner);
  if (error) throw new Error(`watched_companies list failed: ${error.message}`);
  return ((data ?? []) as { company_key: string }[]).map((r) => r.company_key);
}

export async function addWatchedCompany(companyKey: string): Promise<void> {
  const admin = getSupabaseAdminClient();
  const owner = getOwnerUserId();
  const { error } = await admin
    .from('watched_companies')
    .upsert(
      { owner_user_id: owner, company_key: companyKey, added_at: new Date().toISOString() },
      { onConflict: 'owner_user_id,company_key' },
    );
  if (error) throw new Error(`watched_companies add failed: ${error.message}`);
}

export async function removeWatchedCompany(companyKey: string): Promise<void> {
  const admin = getSupabaseAdminClient();
  const owner = getOwnerUserId();
  const { error } = await admin
    .from('watched_companies')
    .delete()
    .eq('owner_user_id', owner)
    .eq('company_key', companyKey);
  if (error) throw new Error(`watched_companies remove failed: ${error.message}`);
}

export async function listDismissedPickIds(): Promise<string[]> {
  const admin = getSupabaseAdminClient();
  const owner = getOwnerUserId();
  const { data, error } = await admin
    .from('dismissed_picks')
    .select('external_job_id')
    .eq('owner_user_id', owner);
  if (error) throw new Error(`dismissed_picks list failed: ${error.message}`);
  return ((data ?? []) as { external_job_id: string }[]).map((r) => r.external_job_id);
}

export async function dismissPick(externalJobId: string): Promise<void> {
  const admin = getSupabaseAdminClient();
  const owner = getOwnerUserId();
  const { error } = await admin
    .from('dismissed_picks')
    .upsert(
      {
        owner_user_id: owner,
        external_job_id: externalJobId,
        dismissed_at: new Date().toISOString(),
      },
      { onConflict: 'owner_user_id,external_job_id' },
    );
  if (error) throw new Error(`dismissed_picks add failed: ${error.message}`);
}
