const SUPABASE_URL_ENV = 'NEXT_PUBLIC_SUPABASE_URL' as const;
const PUBLISHABLE_KEY_ENV = 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY' as const;
const ANON_KEY_ENV = 'NEXT_PUBLIC_SUPABASE_ANON_KEY' as const;
const SECRET_KEY_ENV = 'SUPABASE_SECRET_KEY' as const;
const SERVICE_ROLE_ENV = 'SUPABASE_SERVICE_ROLE_KEY' as const;
const CRON_SECRET_ENV = 'CRON_SECRET' as const;

type SupabaseEnvKey = typeof SUPABASE_URL_ENV | typeof PUBLISHABLE_KEY_ENV | typeof ANON_KEY_ENV;
export type PersistenceAdapter = 'local' | 'supabase';

function readEnv(key: SupabaseEnvKey): string | undefined {
  const value = process.env[key];
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function hasSupabaseEnv(): boolean {
  return Boolean(
    readEnv(SUPABASE_URL_ENV) && (readEnv(PUBLISHABLE_KEY_ENV) || readEnv(ANON_KEY_ENV)),
  );
}

export function getSupabaseEnv() {
  const url = readEnv(SUPABASE_URL_ENV);
  const anonKey = readEnv(PUBLISHABLE_KEY_ENV) ?? readEnv(ANON_KEY_ENV);
  if (!url || !anonKey) {
    throw new Error(
      `Missing Supabase env vars. Set ${SUPABASE_URL_ENV} and ${PUBLISHABLE_KEY_ENV} (or legacy ${ANON_KEY_ENV}).`,
    );
  }
  return { url, anonKey };
}

export function getPersistenceAdapter(): PersistenceAdapter {
  return process.env.NEXT_PUBLIC_PERSISTENCE_ADAPTER === 'supabase' ? 'supabase' : 'local';
}

export function shouldUseSupabaseAdapter(): boolean {
  return getPersistenceAdapter() === 'supabase' && hasSupabaseEnv();
}

/** Server-only. Reads a Supabase secret/service-role key. Never expose to the client. */
export function getSupabaseAdminKey(): string {
  const value = process.env[SECRET_KEY_ENV] ?? process.env[SERVICE_ROLE_ENV];
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(
      `Missing ${SECRET_KEY_ENV} (or legacy ${SERVICE_ROLE_ENV}). Add a Supabase secret key from Project Settings > API keys.`,
    );
  }
  return value.trim();
}

/** Server-only. Reads CRON_SECRET. */
export function getCronSecret(): string | undefined {
  const value = process.env[CRON_SECRET_ENV];
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}
