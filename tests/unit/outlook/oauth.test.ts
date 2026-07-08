import { afterEach, describe, expect, test, vi } from 'vitest';
import {
  buildAuthorizationUrl,
  exchangeAuthorizationCode,
  refreshAccessToken,
  type TokenResponse,
} from '@/lib/outlook/oauth';
import type { OutlookConfig } from '@/lib/outlook/config';

const config: OutlookConfig = {
  clientId: 'client-id',
  clientSecret: 'client-secret',
  tenant: 'tenant-id',
  redirectUri: 'https://app.example/api/outlook/callback',
  tokenEncryptionKey: 'token-key',
  scanSigningSecret: 'scan-secret',
  scopes: ['openid', 'profile', 'offline_access', 'Mail.Read'],
};

function mockTokenResponse(body: Record<string, unknown>, ok = true, status = 200) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok,
      status,
      json: vi.fn().mockResolvedValue(body),
      text: vi.fn().mockResolvedValue(JSON.stringify(body)),
    }),
  );
}

function expectTokenRequest(expectedBody: Record<string, string>) {
  expect(fetch).toHaveBeenCalledTimes(1);
  const [url, init] = vi.mocked(fetch).mock.calls[0]!;

  expect(url).toBe('https://login.microsoftonline.com/tenant-id/oauth2/v2.0/token');
  expect(init?.method).toBe('POST');
  expect(init?.headers).toEqual({ 'Content-Type': 'application/x-www-form-urlencoded' });
  expect(Object.fromEntries(new URLSearchParams(init?.body as string))).toEqual(expectedBody);
}

describe('outlook oauth client', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test('builds a Microsoft authorization URL with expected values', () => {
    const url = new URL(buildAuthorizationUrl(config, 'state-value'));

    expect(url.origin + url.pathname).toBe(
      'https://login.microsoftonline.com/tenant-id/oauth2/v2.0/authorize',
    );
    expect(url.searchParams.get('client_id')).toBe('client-id');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('redirect_uri')).toBe('https://app.example/api/outlook/callback');
    expect(url.searchParams.get('response_mode')).toBe('query');
    expect(url.searchParams.get('scope')).toBe('openid profile offline_access Mail.Read');
    expect(url.searchParams.get('state')).toBe('state-value');
  });

  test('exchanges an authorization code for tokens', async () => {
    mockTokenResponse({
      access_token: 'access-token',
      refresh_token: 'refresh-token',
      scope: 'Mail.Read offline_access',
      expires_in: 3600,
    });

    const expectedTokenResponse: TokenResponse = {
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      scope: 'Mail.Read offline_access',
      expiresIn: 3600,
    };

    await expect(exchangeAuthorizationCode(config, 'auth-code')).resolves.toEqual(
      expectedTokenResponse,
    );
    expectTokenRequest({
      grant_type: 'authorization_code',
      code: 'auth-code',
      client_id: 'client-id',
      client_secret: 'client-secret',
      redirect_uri: 'https://app.example/api/outlook/callback',
    });
  });

  test('refreshes an access token', async () => {
    mockTokenResponse({
      access_token: 'new-access-token',
      refresh_token: 'new-refresh-token',
      scope: 'openid profile offline_access Mail.Read',
      expires_in: 3600,
    });

    const expectedTokenResponse: TokenResponse = {
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
      scope: 'openid profile offline_access Mail.Read',
      expiresIn: 3600,
    };

    await expect(refreshAccessToken(config, 'old-refresh-token')).resolves.toEqual(
      expectedTokenResponse,
    );
    expectTokenRequest({
      grant_type: 'refresh_token',
      refresh_token: 'old-refresh-token',
      scope: 'openid profile offline_access Mail.Read',
      client_id: 'client-id',
      client_secret: 'client-secret',
      redirect_uri: 'https://app.example/api/outlook/callback',
    });
  });

  test('keeps existing refresh token when Microsoft omits a replacement', async () => {
    mockTokenResponse({
      access_token: 'new-access-token',
      scope: 'openid profile offline_access Mail.Read',
      expires_in: 3600,
    });

    await expect(refreshAccessToken(config, 'old-refresh-token')).resolves.toMatchObject({
      refreshToken: 'old-refresh-token',
    });
  });

  test('throws useful errors for token failures', async () => {
    mockTokenResponse({ error: 'invalid_grant', error_description: 'Code expired' }, false, 400);

    await expect(exchangeAuthorizationCode(config, 'auth-code')).rejects.toThrow(
      /Microsoft token request failed \(400\).*invalid_grant.*Code expired/,
    );

    mockTokenResponse({ refresh_token: 'refresh-token', expires_in: 3600 });

    await expect(exchangeAuthorizationCode(config, 'auth-code')).rejects.toThrow(
      /missing access_token/,
    );

    mockTokenResponse({ access_token: 'access-token', expires_in: 3600 });

    await expect(exchangeAuthorizationCode(config, 'auth-code')).rejects.toThrow(
      /missing refresh_token/,
    );
  });
});
