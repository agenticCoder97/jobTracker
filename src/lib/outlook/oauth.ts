import 'server-only';

import type { OutlookConfig } from './config';

export type TokenResponse = {
  accessToken: string;
  refreshToken: string;
  scope: string;
  expiresIn: number;
};

type MicrosoftTokenResponse = {
  access_token?: unknown;
  refresh_token?: unknown;
  scope?: unknown;
  expires_in?: unknown;
  error?: unknown;
  error_description?: unknown;
};

const microsoftLoginBaseUrl = 'https://login.microsoftonline.com';

function endpoint(config: OutlookConfig, path: 'authorize' | 'token'): string {
  return `${microsoftLoginBaseUrl}/${config.tenant}/oauth2/v2.0/${path}`;
}

function joinedScopes(config: OutlookConfig): string {
  return config.scopes.join(' ');
}

export function buildAuthorizationUrl(config: OutlookConfig, state: string): string {
  const url = new URL(endpoint(config, 'authorize'));

  url.searchParams.set('client_id', config.clientId);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('redirect_uri', config.redirectUri);
  url.searchParams.set('response_mode', 'query');
  url.searchParams.set('scope', joinedScopes(config));
  url.searchParams.set('state', state);

  return url.toString();
}

function tokenRequestBody(config: OutlookConfig, values: Record<string, string>): string {
  return new URLSearchParams({
    ...values,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: config.redirectUri,
  }).toString();
}

async function readTokenResponse(response: Response): Promise<MicrosoftTokenResponse> {
  try {
    return (await response.json()) as MicrosoftTokenResponse;
  } catch {
    return {};
  }
}

function describeTokenError(body: MicrosoftTokenResponse): string {
  const details = [body.error, body.error_description].filter(
    (value): value is string => typeof value === 'string' && value.length > 0,
  );

  return details.length > 0 ? `: ${details.join(' - ')}` : '';
}

async function requestToken(
  config: OutlookConfig,
  body: string,
  existingRefreshToken?: string,
): Promise<TokenResponse> {
  const response = await fetch(endpoint(config, 'token'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const tokenBody = await readTokenResponse(response);

  if (!response.ok) {
    throw new Error(
      `Microsoft token request failed (${response.status})${describeTokenError(tokenBody)}`,
    );
  }
  if (typeof tokenBody.access_token !== 'string' || tokenBody.access_token.length === 0) {
    throw new Error('Microsoft token response missing access_token');
  }

  const refreshToken =
    typeof tokenBody.refresh_token === 'string' && tokenBody.refresh_token.length > 0
      ? tokenBody.refresh_token
      : existingRefreshToken;

  if (!refreshToken) {
    throw new Error('Microsoft token response missing refresh_token');
  }

  return {
    accessToken: tokenBody.access_token,
    refreshToken,
    scope: typeof tokenBody.scope === 'string' ? tokenBody.scope : '',
    expiresIn: typeof tokenBody.expires_in === 'number' ? tokenBody.expires_in : 0,
  };
}

export async function exchangeAuthorizationCode(
  config: OutlookConfig,
  code: string,
): Promise<TokenResponse> {
  return requestToken(
    config,
    tokenRequestBody(config, {
      grant_type: 'authorization_code',
      code,
    }),
  );
}

export async function refreshAccessToken(
  config: OutlookConfig,
  refreshToken: string,
): Promise<TokenResponse> {
  return requestToken(
    config,
    tokenRequestBody(config, {
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      scope: joinedScopes(config),
    }),
    refreshToken,
  );
}
