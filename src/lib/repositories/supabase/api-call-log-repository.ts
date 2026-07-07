import 'server-only';

import type { ApiCallLogRepository, ApiCallLogRow } from '@/lib/repositories/types';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';

function uuid(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createSupabaseApiCallLogRepository(): ApiCallLogRepository {
  return {
    async append(input) {
      const row: ApiCallLogRow = {
        ...input,
        id: uuid(),
        createdAt: new Date().toISOString(),
      };
      const client = getSupabaseAdminClient();
      const { error } = await client.from('api_call_log').insert({
        id: row.id,
        provider_id: row.providerId,
        request_path: row.requestPath,
        http_status: row.httpStatus,
        latency_ms: row.latencyMs,
        ratelimit_remaining: row.rateLimitRemaining ?? null,
        owner_user_id: row.ownerUserId ?? null,
        error: row.error ?? null,
        created_at: row.createdAt,
      });
      if (error) {
        console.warn('[supabase] api_call_log insert failed', error);
      }
      return row;
    },
    async list(filter) {
      const client = getSupabaseAdminClient();
      let query = client.from('api_call_log').select('*');
      if (filter?.providerId) query = query.eq('provider_id', filter.providerId);
      query = query.order('created_at', { ascending: false }).limit(filter?.limit ?? 200);
      const { data, error } = await query;
      if (error) {
        console.warn('[supabase] api_call_log select failed', error);
        return [];
      }
      return (data ?? []).map(rowFromDb);
    },
  };
}

type DbRow = {
  id: string;
  provider_id: string;
  request_path: string;
  http_status: number;
  latency_ms: number;
  ratelimit_remaining: number | null;
  owner_user_id: string | null;
  error: string | null;
  created_at: string;
};

function rowFromDb(r: DbRow): ApiCallLogRow {
  return {
    id: r.id,
    providerId: r.provider_id,
    requestPath: r.request_path,
    httpStatus: r.http_status,
    latencyMs: r.latency_ms,
    ...(r.ratelimit_remaining !== null ? { rateLimitRemaining: r.ratelimit_remaining } : {}),
    ...(r.owner_user_id !== null ? { ownerUserId: r.owner_user_id } : {}),
    ...(r.error !== null ? { error: r.error } : {}),
    createdAt: r.created_at,
  };
}
