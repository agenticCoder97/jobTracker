const REQUIRED_ENV = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'] as const;
const SERVICE_ROLE_ENV = 'SUPABASE_SERVICE_ROLE_KEY' as const;
const CRON_SECRET_ENV = 'CRON_SECRET' as const;

type RequiredEnvKey = (typeof REQUIRED_ENV)[number];
export type PersistenceAdapter = 'local' | 'supabase';

function readEnv(key: RequiredEnvKey): string | undefined {
  const value = process.env[key];
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function hasSupabaseEnv(): boolean {
  return REQUIRED_ENV.every((key) => Boolean(readEnv(key)));
}

export function getSupabaseEnv() {
  const url = readEnv('NEXT_PUBLIC_SUPABASE_URL');
  const anonKey = readEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  if (!url || !anonKey) {
    throw new Error(
      'Missing Supabase env vars. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.',
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

/** Server-only. Reads SUPABASE_SERVICE_ROLE_KEY. Never expose to the client. */
export function getSupabaseServiceRoleKey(): string {
  const value = process.env[SERVICE_ROLE_ENV];
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(
      `Missing ${SERVICE_ROLE_ENV}. Pull it via \`vercel env pull .env.local\` or set it in Vercel.`,
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
