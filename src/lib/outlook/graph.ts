import 'server-only';

import type { GraphMessage } from '@/lib/outlook/parser';

export type InboxMessageQuery = {
  now?: Date | undefined;
  lookbackDays?: number | undefined;
  maxMessages?: number | undefined;
};

export async function listInboxMessages(
  accessToken: string,
  query: InboxMessageQuery = {},
): Promise<GraphMessage[]> {
  const now = query.now ?? new Date();
  const lookbackDays = query.lookbackDays ?? 3;
  const maxMessages = Math.min(Math.max(query.maxMessages ?? 50, 1), 500);
  const since = new Date(now.getTime() - lookbackDays * 24 * 60 * 60 * 1000).toISOString();
  const url = new URL('https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages');
  url.searchParams.set(
    '$select',
    'id,internetMessageId,receivedDateTime,subject,from,bodyPreview,webLink,body',
  );
  url.searchParams.set('$filter', `receivedDateTime ge ${since}`);
  url.searchParams.set('$orderby', 'receivedDateTime desc');
  url.searchParams.set('$top', String(maxMessages));
  const response = await fetch(url, {
    headers: {
      authorization: `Bearer ${accessToken}`,
      prefer: 'outlook.body-content-type="text"',
    },
  });
  const json = (await response.json().catch(() => ({}))) as {
    value?: GraphMessage[];
    error?: { message?: string };
  };
  if (!response.ok) {
    throw new Error(json.error?.message || 'Microsoft Graph messages request failed');
  }
  return (json.value ?? []).slice(0, maxMessages);
}

export async function listRecentInboxMessages(
  accessToken: string,
  now = new Date(),
): Promise<GraphMessage[]> {
  return listInboxMessages(accessToken, { now, lookbackDays: 3, maxMessages: 50 });
}
