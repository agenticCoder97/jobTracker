import { NextResponse } from 'next/server';

import { getOutlookConfig } from '@/lib/outlook/config';
import { buildAuthorizationUrl } from '@/lib/outlook/oauth';
import { createOAuthState } from '@/lib/outlook/oauth-state';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STATE_COOKIE = 'outlook_oauth_state';
const STATE_TTL_SECONDS = 10 * 60;

export async function GET() {
  const config = getOutlookConfig();
  const state = createOAuthState(config.scanSigningSecret);
  const response = NextResponse.redirect(buildAuthorizationUrl(config, state));
  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: STATE_TTL_SECONDS,
  });
  return response;
}
