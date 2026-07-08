import 'server-only';

import type { GraphMessage } from '@/lib/outlook/parser';

export async function listRecentInboxMessages(
  accessToken: string,
  now = new Date(),
): Promise<GraphMessage[]> {
  const since = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();
  const url = new URL('https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages');
  url.searchParams.set(
    '$select',
    'id,internetMessageId,receivedDateTime,subject,from,bodyPreview,webLink,body',
  );
  url.searchParams.set('$filter', `receivedDateTime ge ${since}`);
  url.searchParams.set('$orderby', 'receivedDateTime desc');
  url.searchParams.set('$top', '50');
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
  return json.value ?? [];
}
