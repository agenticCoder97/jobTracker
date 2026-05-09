import type { IsoDateTime, Uuid } from '@/lib/types';

/**
 * Audit-trail event mirroring the spec §11.5 shape so a future Supabase
 * adapter can persist the same payloads without rewriting callers.
 */
export type AuditEvent = {
  id: Uuid;
  ownerUserId: Uuid;
  entityType:
    | 'application'
    | 'profile'
    | 'resume'
    | 'coverLetter'
    | 'notification'
    | 'demo';
  entityId: string;
  event: string;
  metadata?: Record<string, unknown>;
  createdAt: IsoDateTime;
};

/** Forbidden metadata keys — must never reach storage or logs. */
export const FORBIDDEN_METADATA_KEYS = [
  'token',
  'apiKey',
  'rawFile',
  'resumeText',
  'coverLetterText',
] as const;
export type ForbiddenMetadataKey = (typeof FORBIDDEN_METADATA_KEYS)[number];

/** Free-form runtime log row. */
export type AppLog = {
  id: Uuid;
  level: 'info' | 'warn' | 'error';
  message: string;
  context?: Record<string, unknown>;
  createdAt: IsoDateTime;
};

/** Append-only audit log repository contract. */
export type EventLogRepository = {
  appendAudit: (input: Omit<AuditEvent, 'id' | 'createdAt'>) => AuditEvent;
  listAudit: (filter?: { entityId?: string; entityType?: AuditEvent['entityType'] }) => AuditEvent[];
  appendLog: (input: Omit<AppLog, 'id' | 'createdAt'>) => AppLog;
  listLogs: () => AppLog[];
  reset: () => void;
};

/** Strip forbidden keys (defence-in-depth before storage / external sinks). */
export function redactMetadata<T extends Record<string, unknown> | undefined>(
  metadata: T,
): T {
  if (!metadata) return metadata;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if ((FORBIDDEN_METADATA_KEYS as readonly string[]).includes(key)) continue;
    out[key] = value;
  }
  return out as T;
}
