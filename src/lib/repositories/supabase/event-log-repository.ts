import { createLocalEventLogRepository } from '@/lib/repositories/local/event-log-repository';
import type { EventLogRepository } from '@/lib/repositories/types';

const REQUIRED_ENV = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'] as const;

export function hasSupabaseRepoEnv(): boolean {
  return REQUIRED_ENV.every((key) => {
    const value = process.env[key];
    return typeof value === 'string' && value.trim().length > 0;
  });
}

/**
 * Temporary shim until Supabase-backed repositories are implemented.
 * Keeps adapter switching code in place without breaking existing callers.
 */
export function createSupabaseEventLogRepository(): EventLogRepository {
  console.warn(
    '[repositories] Supabase adapter selected, but repository persistence is not implemented yet. Using local adapter.',
  );
  return createLocalEventLogRepository();
}
