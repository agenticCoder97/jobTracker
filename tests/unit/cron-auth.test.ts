import { beforeEach, describe, expect, test, vi } from 'vitest';

let secret: string | undefined = 'cron-secret';
vi.mock('@/lib/supabase/env', () => ({ getCronSecret: () => secret }));

import { assertCronAuth, CronAuthError } from '@/app/api/cron/_auth';

describe('cron authentication', () => {
  beforeEach(() => {
    secret = 'cron-secret';
  });

  test('accepts the configured bearer secret', () => {
    const headers = new Headers({ authorization: 'Bearer cron-secret' });
    expect(() => assertCronAuth(headers)).not.toThrow();
  });

  test('rejects a spoofable x-vercel-cron header without the secret', () => {
    const headers = new Headers({ 'x-vercel-cron': '1' });
    expect(() => assertCronAuth(headers)).toThrow(CronAuthError);
  });

  test('rejects requests when CRON_SECRET is missing', () => {
    secret = undefined;
    expect(() => assertCronAuth(new Headers())).toThrow(CronAuthError);
  });
});
