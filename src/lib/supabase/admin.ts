/**
 * Service-role Supabase client.
 *
 * ⚠️ SERVER-ONLY. The service role bypasses RLS — never import this from a
 *    Client Component, route handler that's reachable by users without
 *    authorization, or anything that ships in the browser bundle.
 *
 * Use cases:
 *   - Cron route writing to `cron_runs`, `external_jobs`, `api_call_log`.
 *   - Server actions that need to read `api_credentials`.
 *   - Backfills/maintenance scripts.
 */

import 'server-only';

import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

import { getSupabaseAdminKey, getSupabaseEnv } from '@/lib/supabase/env';

let client: SupabaseClient | undefined;

export function getSupabaseAdminClient(): SupabaseClient {
  if (client) return client;
  const { url } = getSupabaseEnv();
  const adminKey = getSupabaseAdminKey();
  client = createClient(url, adminKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  return client;
}
