import 'server-only';

import { getCronSecret } from '@/lib/supabase/env';

/**
 * Validates the inbound request before any cron work runs.
 *
 * Vercel Cron sends `Authorization: Bearer ${CRON_SECRET}` when that project
 * environment variable is configured. Manual operator calls use the same
 * header so there is only one authentication path.
 *
 * Throws on rejection so the caller can return a 401 cleanly.
 */
export function assertCronAuth(headers: Headers): void {
  const expected = getCronSecret();
  const authz = headers.get('authorization') ?? '';
  if (expected && authz === `Bearer ${expected}`) return;

  throw new CronAuthError();
}

export class CronAuthError extends Error {
  constructor() {
    super('cron: unauthorized');
    this.name = 'CronAuthError';
  }
}
