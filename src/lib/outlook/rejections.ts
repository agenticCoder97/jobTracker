import 'server-only';

import { getOutlookConfig } from '@/lib/outlook/config';
import { decryptToken } from '@/lib/outlook/crypto';
import { listInboxMessages } from '@/lib/outlook/graph';
import { refreshAccessToken } from '@/lib/outlook/oauth';
import { parseRejectionEmail } from '@/lib/outlook/parser';
import { matchRejectionToApplication } from '@/lib/outlook/rejection-matcher';
import { listAppsState, upsertBundles } from '@/lib/repositories/supabase/apps-repository';
import {
  getOutlookConnection,
  listImportedMessageIds,
  recordImportedMessages,
} from '@/lib/repositories/supabase/outlook-repository';

export type RejectionUpdate = {
  applicationId: string;
  displayId: string;
  companyName: string;
  role: string;
  previousStatus: string;
  outcome: 'updated' | 'already-rejected';
  matchMethod: 'company-and-role' | 'unique-company';
  subject: string;
};

export type ProcessOutlookRejectionsResult = {
  scanned: number;
  unprocessed: number;
  detected: number;
  matched: number;
  updated: number;
  alreadyRejected: number;
  skippedAmbiguous: number;
  updates: RejectionUpdate[];
};

export async function processOutlookRejections(
  now = new Date(),
): Promise<ProcessOutlookRejectionsResult> {
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
  const [messages, importedIds, state] = await Promise.all([
    listInboxMessages(token.accessToken, { now, lookbackDays: 14, maxMessages: 200 }),
    listImportedMessageIds(),
    listAppsState(),
  ]);
  const unprocessedMessages = messages.filter(
    (message) => !importedIds.has(message.id) && !importedIds.has(message.internetMessageId ?? ''),
  );
  const candidates = unprocessedMessages
    .map(parseRejectionEmail)
    .filter((candidate): candidate is NonNullable<typeof candidate> => Boolean(candidate));

  let updated = 0;
  let alreadyRejected = 0;
  let skippedAmbiguous = 0;
  const updates: RejectionUpdate[] = [];

  for (const candidate of candidates) {
    const match = matchRejectionToApplication(candidate, state.applications);
    if (!match) {
      skippedAmbiguous += 1;
      continue;
    }

    const application = match.application;
    const companyName = application.companyName ?? application.company;
    const previousStatus = application.status;
    if (application.status !== 'rejected') {
      const changedAt = new Date().toISOString();
      const nextApplication = {
        ...application,
        status: 'rejected' as const,
        rejectedReason: candidate.reason,
        sortIndex: 0,
        updatedAt: changedAt,
        lastActivity: changedAt,
      };
      const currentActivity = state.activity[application.id] ?? {
        comments: [],
        history: [],
        links: [],
        attachments: [],
      };
      const nextActivity = {
        ...currentActivity,
        history: [
          {
            id: crypto.randomUUID(),
            type: 'status' as const,
            who: 'me' as const,
            when: changedAt,
            text: `Status changed to rejected from Outlook: ${candidate.subject}`,
          },
          ...currentActivity.history,
        ],
      };
      await upsertBundles([{ application: nextApplication, activity: nextActivity }]);
      const index = state.applications.findIndex((item) => item.id === application.id);
      if (index >= 0) state.applications[index] = nextApplication;
      state.activity[application.id] = nextActivity;
      updated += 1;
    } else {
      alreadyRejected += 1;
    }

    await recordImportedMessages([
      {
        messageId: candidate.messageId,
        ...(candidate.internetMessageId ? { internetMessageId: candidate.internetMessageId } : {}),
        applicationId: application.id,
        companyName,
        role: application.role,
        receivedAt: candidate.receivedAt,
      },
    ]);
    importedIds.add(candidate.messageId);
    if (candidate.internetMessageId) importedIds.add(candidate.internetMessageId);
    updates.push({
      applicationId: application.id,
      displayId: application.displayId,
      companyName,
      role: application.role,
      previousStatus,
      outcome: previousStatus === 'rejected' ? 'already-rejected' : 'updated',
      matchMethod: match.method,
      subject: candidate.subject,
    });
  }

  return {
    scanned: messages.length,
    unprocessed: unprocessedMessages.length,
    detected: candidates.length,
    matched: updates.length,
    updated,
    alreadyRejected,
    skippedAmbiguous,
    updates,
  };
}
