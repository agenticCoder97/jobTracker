import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

import { getSupabaseEnv } from '@/lib/supabase/env';

let client: SupabaseClient | undefined;

export function getSupabaseBrowserClient(): SupabaseClient {
  if (client) return client;
  const { url, anonKey } = getSupabaseEnv();
  client = createBrowserClient(url, anonKey);
  return client;
}
