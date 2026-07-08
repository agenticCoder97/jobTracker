import 'server-only';

import { getOwnerUserId } from '@/lib/server/owner';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import type { Uuid } from '@/lib/types';

export type StoredOutlookConnection = {
  email: string | null;
  refreshTokenCiphertext: string;
  refreshTokenIv: string;
  refreshTokenTag: string;
  scope: string;
};

export type SaveOutlookConnectionInput = {
  email?: string | undefined;
  refreshTokenCiphertext: string;
  refreshTokenIv: string;
  refreshTokenTag: string;
  scope: string;
};

export type ImportedMessageRow = {
  messageId: string;
  internetMessageId?: string | undefined;
  applicationId: Uuid;
  companyName: string;
  role: string;
  receivedAt: string;
};

export async function getOutlookConnection(): Promise<StoredOutlookConnection | null> {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from('outlook_connections')
    .select('email, refresh_token_ciphertext, refresh_token_iv, refresh_token_tag, scope')
    .eq('owner_user_id', getOwnerUserId())
    .maybeSingle();
  if (error) throw new Error(`outlook connection read failed: ${error.message}`);
  if (!data) return null;
  return {
    email: data.email ?? null,
    refreshTokenCiphertext: data.refresh_token_ciphertext,
    refreshTokenIv: data.refresh_token_iv,
    refreshTokenTag: data.refresh_token_tag,
    scope: data.scope,
  };
}

export async function saveOutlookConnection(input: SaveOutlookConnectionInput): Promise<void> {
  const admin = getSupabaseAdminClient();
  const now = new Date().toISOString();
  const { error } = await admin.from('outlook_connections').upsert(
    {
      owner_user_id: getOwnerUserId(),
      email: input.email ?? null,
      refresh_token_ciphertext: input.refreshTokenCiphertext,
      refresh_token_iv: input.refreshTokenIv,
      refresh_token_tag: input.refreshTokenTag,
      scope: input.scope,
      connected_at: now,
      updated_at: now,
    },
    { onConflict: 'owner_user_id' },
  );
  if (error) throw new Error(`outlook connection save failed: ${error.message}`);
}

export async function listImportedMessageIds(): Promise<Set<string>> {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from('outlook_imported_messages')
    .select('message_id, internet_message_id')
    .eq('owner_user_id', getOwnerUserId());
  if (error) throw new Error(`outlook imported messages read failed: ${error.message}`);
  const ids = new Set<string>();
  for (const row of data ?? []) {
    ids.add(row.message_id);
    if (row.internet_message_id) ids.add(row.internet_message_id);
  }
  return ids;
}

export async function recordImportedMessages(rows: ImportedMessageRow[]): Promise<void> {
  if (rows.length === 0) return;
  const admin = getSupabaseAdminClient();
  const owner = getOwnerUserId();
  const { error } = await admin.from('outlook_imported_messages').upsert(
    rows.map((row) => ({
      owner_user_id: owner,
      message_id: row.messageId,
      internet_message_id: row.internetMessageId ?? null,
      application_id: row.applicationId,
      company_name: row.companyName,
      role: row.role,
      received_at: row.receivedAt,
      imported_at: new Date().toISOString(),
    })),
    { onConflict: 'owner_user_id,message_id' },
  );
  if (error) throw new Error(`outlook imported messages save failed: ${error.message}`);
}
