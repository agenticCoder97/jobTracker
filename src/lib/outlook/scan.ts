import 'server-only';

import { signImportCandidate, type SignedImportCandidate } from '@/lib/outlook/candidate-signing';
import { getOutlookConfig } from '@/lib/outlook/config';
import { decryptToken } from '@/lib/outlook/crypto';
import { listRecentInboxMessages } from '@/lib/outlook/graph';
import { refreshAccessToken } from '@/lib/outlook/oauth';
import { parseApplicationEmail } from '@/lib/outlook/parser';
import {
  getOutlookConnection,
  listImportedMessageIds,
} from '@/lib/repositories/supabase/outlook-repository';

export type ScanOutlookApplicationsResult = {
  connectedEmail: string | null;
  candidates: SignedImportCandidate[];
};

export async function scanOutlookApplications(): Promise<ScanOutlookApplicationsResult> {
  const config = getOutlookConfig();
  const connection = await getOutlookConnection();
  if (!connection) throw new Error('Outlook is not connected');

  const refreshToken = decryptToken(
    {
      ciphertext: connection.refreshTokenCiphertext,
      iv: connection.refreshTokenIv,
      tag: connection.refreshTokenTag,
    },
    config.tokenEncryptionKey,
  );
  const token = await refreshAccessToken(config, refreshToken);
  const [messages, importedIds] = await Promise.all([
    listRecentInboxMessages(token.accessToken),
    listImportedMessageIds(),
  ]);
  const candidates = messages
    .filter(
      (message) =>
        !importedIds.has(message.id) && !importedIds.has(message.internetMessageId ?? ''),
    )
    .map(parseApplicationEmail)
    .filter((candidate): candidate is NonNullable<typeof candidate> => Boolean(candidate))
    .sort((a, b) => b.score - a.score || b.receivedAt.localeCompare(a.receivedAt))
    .map((candidate) => signImportCandidate(candidate, config.scanSigningSecret));

  return { connectedEmail: connection.email, candidates };
}
