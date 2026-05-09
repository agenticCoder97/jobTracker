/**
 * Server-only repository singletons.
 *
 * Use these from cron routes and server actions where the service role key
 * is available and you want writes to land in Supabase. The default exports
 * in `./index.ts` are universal-safe (local fallback) and should be used
 * everywhere else.
 */

import 'server-only';

import {
  createSupabaseEventLogRepository,
  hasSupabaseRepoEnv,
} from '@/lib/repositories/supabase/event-log-repository';
import { createLocalEventLogRepository } from '@/lib/repositories/local/event-log-repository';
import { createSupabaseApiCallLogRepository } from '@/lib/repositories/supabase/api-call-log-repository';
import { createSupabaseUserActionRepository } from '@/lib/repositories/supabase/user-action-repository';
import { getPersistenceAdapter } from '@/lib/supabase/env';
import type {
  ApiCallLogRepository,
  EventLogRepository,
  UserActionRepository,
} from '@/lib/repositories/types';

let eventLogServer: EventLogRepository | undefined;
let apiCallLogServer: ApiCallLogRepository | undefined;
let userActionServer: UserActionRepository | undefined;

export function getEventLogRepository(): EventLogRepository {
  if (eventLogServer) return eventLogServer;
  const adapter = getPersistenceAdapter();
  if (adapter === 'supabase' && hasSupabaseRepoEnv()) {
    eventLogServer = createSupabaseEventLogRepository();
  } else {
    eventLogServer = createLocalEventLogRepository();
  }
  return eventLogServer;
}

export function getApiCallLogRepository(): ApiCallLogRepository {
  if (!apiCallLogServer) apiCallLogServer = createSupabaseApiCallLogRepository();
  return apiCallLogServer;
}

export function getUserActionRepository(): UserActionRepository {
  if (!userActionServer) userActionServer = createSupabaseUserActionRepository();
  return userActionServer;
}
