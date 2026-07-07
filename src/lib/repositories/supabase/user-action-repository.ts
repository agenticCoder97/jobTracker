import 'server-only';

import { redactMetadata } from '@/lib/repositories/types';
import type { UserActionRepository, UserActionRow } from '@/lib/repositories/types';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';

function uuid(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createSupabaseUserActionRepository(): UserActionRepository {
  return {
    async append(input) {
      const row: UserActionRow = {
        ...input,
        ...(input.metadata !== undefined ? { metadata: redactMetadata(input.metadata) } : {}),
        id: uuid(),
        occurredAt: new Date().toISOString(),
      };
      const client = getSupabaseAdminClient();
      const { error } = await client.from('user_actions').insert({
        id: row.id,
        owner_user_id: row.ownerUserId ?? null,
        kind: row.kind,
        target: row.target ?? null,
        metadata: row.metadata ?? null,
        occurred_at: row.occurredAt,
      });
      if (error) {
        console.warn('[supabase] user_actions insert failed', error);
      }
      return row;
    },
    async list(filter) {
      const client = getSupabaseAdminClient();
      let query = client.from('user_actions').select('*');
      if (filter?.ownerUserId) query = query.eq('owner_user_id', filter.ownerUserId);
      query = query.order('occurred_at', { ascending: false }).limit(filter?.limit ?? 200);
      const { data, error } = await query;
      if (error) {
        console.warn('[supabase] user_actions select failed', error);
        return [];
      }
      return (data ?? []).map(rowFromDb);
    },
  };
}

type DbRow = {
  id: string;
  owner_user_id: string | null;
  kind: string;
  target: string | null;
  metadata: Record<string, unknown> | null;
  occurred_at: string;
};

function rowFromDb(r: DbRow): UserActionRow {
  return {
    id: r.id,
    ...(r.owner_user_id !== null ? { ownerUserId: r.owner_user_id } : {}),
    kind: r.kind,
    ...(r.target !== null ? { target: r.target } : {}),
    ...(r.metadata !== null ? { metadata: r.metadata } : {}),
    occurredAt: r.occurred_at,
  };
}
