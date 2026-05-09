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

/** Outbound HTTP call to an external provider. Persisted to `api_call_log`. */
export type ApiCallLogRow = {
  id: Uuid;
  providerId: string;
  requestPath: string;
  httpStatus: number;
  latencyMs: number;
  rateLimitRemaining?: number | undefined;
  ownerUserId?: Uuid | undefined;
  error?: string | undefined;
  createdAt: IsoDateTime;
};

export type ApiCallLogRepository = {
  append: (input: Omit<ApiCallLogRow, 'id' | 'createdAt'>) => Promise<ApiCallLogRow>;
  list: (filter?: { providerId?: string; limit?: number }) => Promise<ApiCallLogRow[]>;
};

/** Client-side telemetry event. Persisted to `user_actions`. */
export type UserActionRow = {
  id: Uuid;
  ownerUserId?: Uuid | undefined;
  kind: string;
  target?: string | undefined;
  metadata?: Record<string, unknown> | undefined;
  occurredAt: IsoDateTime;
};

export type UserActionRepository = {
  append: (input: Omit<UserActionRow, 'id' | 'occurredAt'>) => Promise<UserActionRow>;
  list: (filter?: { ownerUserId?: string; limit?: number }) => Promise<UserActionRow[]>;
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
