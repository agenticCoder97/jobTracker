import 'server-only';

import {
  DEFAULT_SEARCH_PREFERENCES,
  normalizeSearchPreferences,
  type SearchPreferences,
} from '@/lib/research/preferences';
import { getOwnerUserId } from '@/lib/server/owner';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';

const PREFS_KEY = 'searchPreferences';

/** Reads searchPreferences out of the owner's profiles.payload, defaulting. */
export async function getSearchPreferences(): Promise<SearchPreferences> {
  const admin = getSupabaseAdminClient();
  const owner = getOwnerUserId();
  const { data, error } = await admin
    .from('profiles')
    .select('payload')
    .eq('owner_user_id', owner)
    .maybeSingle();
  if (error) throw new Error(`profiles read failed: ${error.message}`);
  const payload = (data?.payload ?? {}) as Record<string, unknown>;
  const raw = (payload[PREFS_KEY] ?? {}) as Partial<SearchPreferences>;
  return normalizeSearchPreferences(raw);
}

/** Merges searchPreferences into the owner's profiles.payload (upsert). */
export async function setSearchPreferences(
  input: Partial<SearchPreferences>,
): Promise<SearchPreferences> {
  const admin = getSupabaseAdminClient();
  const owner = getOwnerUserId();
  const next = normalizeSearchPreferences(input);

  const { data, error: readError } = await admin
    .from('profiles')
    .select('payload')
    .eq('owner_user_id', owner)
    .maybeSingle();
  if (readError) throw new Error(`profiles read failed: ${readError.message}`);

  const payload = { ...((data?.payload ?? {}) as Record<string, unknown>), [PREFS_KEY]: next };
  const { error: writeError } = await admin
    .from('profiles')
    .upsert(
      { owner_user_id: owner, payload, updated_at: new Date().toISOString() },
      { onConflict: 'owner_user_id' },
    );
  if (writeError) throw new Error(`profiles write failed: ${writeError.message}`);
  return next;
}

export { DEFAULT_SEARCH_PREFERENCES };
