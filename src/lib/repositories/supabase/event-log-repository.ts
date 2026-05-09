/**
 * Supabase-backed EventLogRepository.
 *
 * Strategy:
 *   - Writes are best-effort and synchronous-from-the-caller's-perspective:
 *     the contract returns a fully-formed `AuditEvent`/`AppLog` immediately
 *     and the actual INSERT is fire-and-forget so audit emission never
 *     blocks user-facing actions (mirrors the local adapter's contract).
 *   - Reads still hit the local in-memory mirror for parity with v1; once
 *     the activity tab moves server-side they'll switch to a real query.
 *   - Server-only: only reachable through `repositories/server.ts`, which
 *     keeps the admin client out of the browser bundle.
 */

import 'server-only';

import { createLocalEventLogRepository } from '@/lib/repositories/local/event-log-repository';
import { redactMetadata } from '@/lib/repositories/types';
import type { AppLog, AuditEvent, EventLogRepository } from '@/lib/repositories/types';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';

const REQUIRED_ENV = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'] as const;

export function hasSupabaseRepoEnv(): boolean {
  return REQUIRED_ENV.every((key) => {
    const value = process.env[key];
    return typeof value === 'string' && value.trim().length > 0;
  });
}

function uuid(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createSupabaseEventLogRepository(): EventLogRepository {
  // Local mirror keeps list*() honest for now and gives us a fallback if the
  // service-role write fails (e.g. transient network).
  const mirror = createLocalEventLogRepository();

  return {
    appendAudit(input) {
      const event: AuditEvent = {
        ...input,
        ...(input.metadata !== undefined ? { metadata: redactMetadata(input.metadata) } : {}),
        id: uuid(),
        createdAt: new Date().toISOString(),
      };
      // Mirror locally first so the return value is consistent.
      mirror.appendAudit(input);
      void writeAudit(event).catch((err) => {
        console.warn('[supabase] audit_events insert failed', err);
      });
      return event;
    },
    listAudit(filter) {
      return mirror.listAudit(filter);
    },
    appendLog(input) {
      const log: AppLog = {
        ...input,
        ...(input.context !== undefined ? { context: redactMetadata(input.context) } : {}),
        id: uuid(),
        createdAt: new Date().toISOString(),
      };
      mirror.appendLog(input);
      void writeLog(log).catch((err) => {
        console.warn('[supabase] app_logs insert failed', err);
      });
      return log;
    },
    listLogs() {
      return mirror.listLogs();
    },
    reset() {
      mirror.reset();
    },
  };
}

async function writeAudit(event: AuditEvent): Promise<void> {
  const client = getSupabaseAdminClient();
  const { error } = await client.from('audit_events').insert({
    id: event.id,
    owner_user_id: event.ownerUserId,
    entity_type: event.entityType,
    entity_id: event.entityId,
    event: event.event,
    metadata: event.metadata ?? null,
    created_at: event.createdAt,
  });
  if (error) throw error;
}

async function writeLog(log: AppLog): Promise<void> {
  const client = getSupabaseAdminClient();
  const { error } = await client.from('app_logs').insert({
    id: log.id,
    level: log.level,
    message: log.message,
    context: log.context ?? null,
    created_at: log.createdAt,
  });
  if (error) throw error;
}
