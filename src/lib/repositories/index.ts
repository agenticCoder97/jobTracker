import { createLocalApiCallLogRepository } from '@/lib/repositories/local/api-call-log-repository';
import { createLocalEventLogRepository } from '@/lib/repositories/local/event-log-repository';
import { createLocalUserActionRepository } from '@/lib/repositories/local/user-action-repository';
import type {
  ApiCallLogRepository,
  EventLogRepository,
  UserActionRepository,
} from '@/lib/repositories/types';

export type {
  ApiCallLogRepository,
  ApiCallLogRow,
  AppLog,
  AuditEvent,
  EventLogRepository,
  UserActionRepository,
  UserActionRow,
} from '@/lib/repositories/types';
export { FORBIDDEN_METADATA_KEYS, redactMetadata } from '@/lib/repositories/types';

/**
 * Universal-safe repository singletons.
 *
 * These run in both client and server bundles, so they must NOT reach into
 * the service-role admin client. Today they're local in-memory + Zustand
 * persist; once auth lands, server actions will dual-write through the
 * Supabase singletons exported from `./server.ts`.
 *
 * Selection of a real Supabase backend is server-only and lives in
 * `./server.ts` to keep `server-only` modules out of the client bundle.
 */
export const eventLog: EventLogRepository = createLocalEventLogRepository();
export const apiCallLog: ApiCallLogRepository = createLocalApiCallLogRepository();
export const userAction: UserActionRepository = createLocalUserActionRepository();
