import 'server-only';

import { getCronSecret } from '@/lib/supabase/env';

/**
 * Validates the inbound request before any cron work runs.
 *
 * Vercel Cron supplies the `x-vercel-cron` header on triggered invocations.
 * For manual hits (curl from operator's machine, internal admin tooling)
 * we accept a `Authorization: Bearer ${CRON_SECRET}` fallback.
 *
 * Throws on rejection so the caller can return a 401 cleanly.
 */
export function assertCronAuth(headers: Headers): void {
  if (headers.get('x-vercel-cron')) return;

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
