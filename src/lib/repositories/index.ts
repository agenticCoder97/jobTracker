import { createLocalEventLogRepository } from '@/lib/repositories/local/event-log-repository';
import {
  createSupabaseEventLogRepository,
  hasSupabaseRepoEnv,
} from '@/lib/repositories/supabase/event-log-repository';
import type { EventLogRepository } from '@/lib/repositories/types';

export type { AppLog, AuditEvent, EventLogRepository } from '@/lib/repositories/types';
export { FORBIDDEN_METADATA_KEYS, redactMetadata } from '@/lib/repositories/types';

type PersistenceAdapter = 'local' | 'supabase';

const requestedAdapter = (process.env.NEXT_PUBLIC_PERSISTENCE_ADAPTER ??
  'local') as PersistenceAdapter;

function resolveEventLogRepository(): EventLogRepository {
  if (requestedAdapter === 'supabase') {
    if (!hasSupabaseRepoEnv()) {
      console.warn(
        '[repositories] NEXT_PUBLIC_PERSISTENCE_ADAPTER=supabase but Supabase env vars are missing. Falling back to local adapter.',
      );
      return createLocalEventLogRepository();
    }
    return createSupabaseEventLogRepository();
  }
  return createLocalEventLogRepository();
}

/**
 * Process-singleton repositories. v1 defaults to local adapter.
 * Supabase can be enabled with NEXT_PUBLIC_PERSISTENCE_ADAPTER=supabase.
 */
export const eventLog: EventLogRepository = resolveEventLogRepository();
