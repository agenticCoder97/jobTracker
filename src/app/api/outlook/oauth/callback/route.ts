import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { getOutlookConfig } from '@/lib/outlook/config';
import { encryptToken } from '@/lib/outlook/crypto';
import { exchangeAuthorizationCode } from '@/lib/outlook/oauth';
import { verifyOAuthState } from '@/lib/outlook/oauth-state';
import { saveOutlookConnection } from '@/lib/repositories/supabase/outlook-repository';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STATE_COOKIE = 'outlook_oauth_state';

/** Best-effort mailbox address for display; never blocks the connection. */
async function fetchUserEmail(accessToken: string): Promise<string | undefined> {
  try {
    const res = await fetch('https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName', {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return undefined;
    const json = (await res.json()) as { mail?: string; userPrincipalName?: string };
    return json.mail ?? json.userPrincipalName ?? undefined;
  } catch {
    return undefined;
  }
}

function errorRedirect(request: Request, reason: string) {
  return NextResponse.redirect(
    new URL(`/?outlook=error&reason=${encodeURIComponent(reason)}`, request.url),
  );
}

export async function GET(request: Request) {
  const config = getOutlookConfig();
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const cookieStore = await cookies();
  const storedState = cookieStore.get(STATE_COOKIE)?.value;

  if (
    !code ||
    !state ||
    !storedState ||
    state !== storedState ||
    !verifyOAuthState(storedState, config.scanSigningSecret)
  ) {
    return errorRedirect(request, 'invalid_state');
  }

  try {
    const token = await exchangeAuthorizationCode(config, code);
    const encrypted = encryptToken(token.refreshToken, config.tokenEncryptionKey);
    const email = await fetchUserEmail(token.accessToken);
    await saveOutlookConnection({
      ...(email ? { email } : {}),
      refreshTokenCiphertext: encrypted.ciphertext,
      refreshTokenIv: encrypted.iv,
      refreshTokenTag: encrypted.tag,
      scope: token.scope,
    });
  } catch (error) {
    return errorRedirect(request, error instanceof Error ? error.message : 'exchange_failed');
  }

  const response = NextResponse.redirect(new URL('/?outlook=connected', request.url));
  response.cookies.set(STATE_COOKIE, '', { path: '/', maxAge: 0 });
  return response;
}
