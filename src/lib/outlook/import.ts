import 'server-only';

import { createServerApplicationBundle } from '@/lib/applications/server-card-factory';
import { type SignedImportCandidate, verifyImportCandidate } from '@/lib/outlook/candidate-signing';
import { getOutlookConfig } from '@/lib/outlook/config';
import { upsertBundles } from '@/lib/repositories/supabase/apps-repository';
import { recordImportedMessages } from '@/lib/repositories/supabase/outlook-repository';

export type ImportOutlookResult = {
  imported: { applicationId: string; displayId: string; companyName: string; role: string }[];
};

export async function importOutlookCandidates(
  signedCandidates: SignedImportCandidate[],
): Promise<ImportOutlookResult> {
  const config = getOutlookConfig();
  const candidates = signedCandidates.map((candidate) =>
    verifyImportCandidate(candidate, config.scanSigningSecret),
  );
  const bundles = candidates.map((candidate) => createServerApplicationBundle(candidate.extracted));
  await upsertBundles(bundles);
  await recordImportedMessages(
    candidates.map((candidate, index) => ({
      messageId: candidate.messageId,
      ...(candidate.internetMessageId ? { internetMessageId: candidate.internetMessageId } : {}),
      applicationId: bundles[index]!.application.id,
      companyName: candidate.extracted.companyName,
      role: candidate.extracted.role,
      receivedAt: candidate.receivedAt,
    })),
  );
  return {
    imported: bundles.map((bundle) => ({
      applicationId: bundle.application.id,
      displayId: bundle.application.displayId,
      companyName: bundle.application.companyName ?? bundle.application.company,
      role: bundle.application.role,
    })),
  };
}
