import { createLocalEventLogRepository } from '@/lib/repositories/local/event-log-repository';
import type { EventLogRepository } from '@/lib/repositories/types';

export type { AppLog, AuditEvent, EventLogRepository } from '@/lib/repositories/types';
export { FORBIDDEN_METADATA_KEYS, redactMetadata } from '@/lib/repositories/types';

/**
 * Process-singleton repositories. v1 uses the in-memory local adapter.
 * Future Supabase milestone swaps these factories without touching callers.
 */
export const eventLog: EventLogRepository = createLocalEventLogRepository();
