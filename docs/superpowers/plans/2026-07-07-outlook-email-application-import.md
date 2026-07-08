# Outlook Email Application Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an Outlook-powered Home board scan button that finds job application confirmation emails from the last three days, lets the user review them in an inbox-style modal, and imports selected emails as real applied application cards.

**Architecture:** Microsoft Graph OAuth, mailbox scanning, token storage, parsing, candidate signing, dedupe, and card creation all run server-side through Next.js route handlers. The UI gets only signed import candidates and calls server routes; refresh tokens stay encrypted in Supabase and imported cards are written via the existing service-role `upsertBundles()` path pinned to `getOwnerUserId()`. Azure setup and local env validation happen first so later route and UI smoke tests can use a real Microsoft account instead of only mocks.

**Tech Stack:** Next.js 15 App Router (breaking-changed; read current Next docs before route work), React 19, TypeScript with `exactOptionalPropertyTypes`, Supabase service-role repositories, Microsoft identity platform authorization-code flow, Microsoft Graph `/me/mailFolders/inbox/messages`, Node `crypto`, Zod, Vitest, Playwright.

---

## Source References

- Design spec: `docs/superpowers/specs/2026-07-07-outlook-email-application-import-design.md`
- Server board persistence: `src/lib/repositories/supabase/apps-repository.ts`
- Board card defaults to mirror server-side: `src/lib/store/apps-store.ts`
- Microsoft OAuth auth-code flow: https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow
- Microsoft Graph list messages: https://learn.microsoft.com/en-us/graph/api/user-list-messages?view=graph-rest-1.0
- Microsoft scopes and `offline_access`: https://learn.microsoft.com/en-us/entra/identity-platform/scopes-oidc

## Ground Rules

- Azure setup is Task 1. Do not build the UI first; the first real smoke should prove the Microsoft redirect URI and consent work.
- Before editing any `src/app/**/route.ts` file, read current Next.js App Router route handler docs. The repo instruction says `node_modules/next/dist/docs/`; if that directory is missing, use the installed Next package docs or official Next.js docs and note the source in the task commit message.
- Server-only files start with `import 'server-only';`.
- The browser never receives OAuth secrets, refresh tokens, or raw Microsoft access tokens.
- Do not persist raw email bodies. Store only encrypted refresh token data, dedupe identifiers, extracted card fields, and normal application/activity payloads.
- Keep CI deterministic. Real Microsoft OAuth is a manual/local smoke test; unit tests and Playwright tests mock Graph and app routes.
- `exactOptionalPropertyTypes` is on. For optional values, use conditional spreads instead of assigning `undefined`.
- Use `pnpm` commands because `package.json` declares `packageManager: "pnpm@10.11.0"`.

## File Map

- Create `docs/backend/migrations/0004_outlook_email_import.sql`: Supabase tables for one Outlook connection and imported message dedupe.
- Create `src/lib/outlook/config.ts`: validates Outlook env vars and exposes OAuth constants.
- Create `src/lib/outlook/crypto.ts`: AES-256-GCM token encryption and decryption.
- Create `src/lib/outlook/oauth-state.ts`: signed, short-lived OAuth state cookie helpers.
- Create `src/lib/outlook/oauth.ts`: builds Microsoft authorization URL and exchanges/refreshes tokens.
- Create `src/lib/outlook/graph.ts`: Graph list messages wrapper with narrow query options.
- Create `src/lib/outlook/parser.ts`: deterministic application-confirmation parser and scoring.
- Create `src/lib/outlook/candidate-signing.ts`: signs scan candidates sent to the browser and verifies import payloads.
- Create `src/lib/outlook/scan.ts`: refreshes tokens, calls Graph, parses, dedupes, signs candidates.
- Create `src/lib/outlook/import.ts`: verifies candidates, creates app bundles, records imports.
- Create `src/lib/applications/server-card-factory.ts`: server-side equivalent of `createCard()` defaults.
- Create `src/lib/repositories/supabase/outlook-repository.ts`: service-role read/write for connections and imports.
- Create route handlers under `src/app/api/outlook/**/route.ts`: `oauth/start`, `oauth/callback`, `status`, `scan`, `import`.
- Create `src/components/jobtracker/OutlookImportDialog.tsx`: inbox-style review modal.
- Modify `src/components/jobtracker/JobTrackerApp.tsx`: add the `Scan email` button beside the board counter and mount the dialog.
- Create focused unit tests under `tests/unit/outlook/`, `tests/unit/applications/`, `tests/unit/repositories/`, and `tests/unit/api/outlook/`.
- Modify or create Playwright coverage under `tests/e2e/` for the mocked UI scan/import path.

---

## Task 0: Baseline And Next Docs Check

**Files:**
- Read: `package.json`
- Read: `node_modules/next/dist/docs/` or official Next.js route handler docs if local docs are absent

- [ ] **Step 1: Confirm baseline commands**

Run:

```bash
pnpm run typecheck
pnpm run lint
pnpm run test:unit
```

Expected: all pass before Outlook work. If a pre-existing failure appears, save the exact command and failure text in the task notes before changing code.

- [ ] **Step 2: Confirm Next route handler docs source**

Run:

```bash
test -d node_modules/next/dist/docs && find node_modules/next/dist/docs -maxdepth 3 -type f | sed -n '1,20p'
```

Expected: either local docs list appears, or the command exits non-zero because the docs folder is not packaged. If local docs are missing, use official Next.js App Router route-handler docs before Task 9 and record that source in the Task 9 commit body.

- [ ] **Step 3: Commit nothing**

This task is read-only.

---

## Task 1: Azure App Registration And Real Local Env

**Files:**
- Modify: `.env.local` (local only, never commit)
- Configure: Azure Portal App Registration
- Configure: Vercel project env vars

- [ ] **Step 1: Create Azure app registration**

In Azure Portal:

1. Open **Microsoft Entra ID**.
2. Go to **App registrations**.
3. Click **New registration**.
4. Name: `JobTracker Outlook Import`.
5. Supported account types: `Accounts in any organizational directory and personal Microsoft accounts`.
6. Redirect URI platform: `Web`.
7. Redirect URI: `http://localhost:3000/api/outlook/oauth/callback`.
8. Click **Register**.

Expected: the app overview page shows an **Application (client) ID**. Save that value as `MICROSOFT_CLIENT_ID`.

- [ ] **Step 2: Add production redirect URI**

In the Azure app:

1. Open **Authentication**.
2. Under **Web**, add redirect URI:

```text
https://saisai-gamma.vercel.app/api/outlook/oauth/callback
```

3. Confirm the local redirect URI remains:

```text
http://localhost:3000/api/outlook/oauth/callback
```

4. Click **Save**.

Expected: both redirect URIs are listed under Web platform.

- [ ] **Step 3: Add delegated Graph permissions**

In the Azure app:

1. Open **API permissions**.
2. Click **Add a permission**.
3. Select **Microsoft Graph**.
4. Select **Delegated permissions**.
5. Add:

```text
Mail.Read
offline_access
openid
profile
```

6. Click **Add permissions**.

Expected: permissions list includes all four delegated permissions. Admin consent is not required for a personal/single-user smoke if the account can consent interactively.

- [ ] **Step 4: Create a client secret**

In the Azure app:

1. Open **Certificates & secrets**.
2. Click **New client secret**.
3. Description: `JobTracker local and Vercel`.
4. Expiration: choose a finite period and record the expiration date outside the repo.
5. Copy the **Value**, not the Secret ID.

Expected: client secret value is saved as `MICROSOFT_CLIENT_SECRET`.

- [ ] **Step 5: Generate local signing/encryption secrets**

Run:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

Expected: two different random strings. Use the first as `OUTLOOK_TOKEN_ENCRYPTION_KEY`; use the second as `OUTLOOK_SCAN_SIGNING_SECRET`.

- [ ] **Step 6: Add local env vars**

Edit `.env.local` and add:

```bash
MICROSOFT_CLIENT_ID=<application-client-id-from-azure>
MICROSOFT_CLIENT_SECRET=<client-secret-value-from-azure>
MICROSOFT_TENANT=common
MICROSOFT_REDIRECT_URI=http://localhost:3000/api/outlook/oauth/callback
OUTLOOK_TOKEN_ENCRYPTION_KEY=<first-random-base64url-secret>
OUTLOOK_SCAN_SIGNING_SECRET=<second-random-base64url-secret>
```

Expected: `.env.local` remains untracked. Confirm with:

```bash
git status --short .env.local
```

Expected output: no tracked change for `.env.local`.

- [ ] **Step 7: Add Vercel env vars**

Run these commands and paste values when prompted:

```bash
vercel env add MICROSOFT_CLIENT_ID production
vercel env add MICROSOFT_CLIENT_SECRET production
vercel env add MICROSOFT_TENANT production
vercel env add MICROSOFT_REDIRECT_URI production
vercel env add OUTLOOK_TOKEN_ENCRYPTION_KEY production
vercel env add OUTLOOK_SCAN_SIGNING_SECRET production
```

Use:

```text
MICROSOFT_TENANT=common
MICROSOFT_REDIRECT_URI=https://saisai-gamma.vercel.app/api/outlook/oauth/callback
```

Expected: Vercel CLI confirms each variable was added for production.

- [ ] **Step 8: Commit nothing**

Azure and env setup should not commit secrets. Continue to Task 2 after `.env.local` and Vercel envs are configured.

---

## Task 2: Outlook Database Migration

**Files:**
- Create: `docs/backend/migrations/0004_outlook_email_import.sql`

- [ ] **Step 1: Write migration SQL**

Create `docs/backend/migrations/0004_outlook_email_import.sql`:

```sql
-- JobTracker - Migration 0004: Outlook email import
-- Single-user, service-role-only. The browser never accesses these tables.

create table if not exists public.outlook_connections (
  owner_user_id uuid primary key references public.users (id) on delete cascade,
  email text,
  refresh_token_ciphertext text not null,
  refresh_token_iv text not null,
  refresh_token_tag text not null,
  scope text not null,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.outlook_imported_messages (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.users (id) on delete cascade,
  message_id text not null,
  internet_message_id text,
  application_id uuid references public.applications (id) on delete set null,
  company_name text,
  role text,
  received_at timestamptz,
  imported_at timestamptz not null default now()
);

create unique index if not exists outlook_imported_messages_owner_message_id
  on public.outlook_imported_messages (owner_user_id, message_id);

create unique index if not exists outlook_imported_messages_owner_internet_message_id
  on public.outlook_imported_messages (owner_user_id, internet_message_id)
  where internet_message_id is not null;

alter table public.outlook_connections enable row level security;
alter table public.outlook_imported_messages enable row level security;

-- No anon/authenticated policies: service role only while the app is single-user.
```

- [ ] **Step 2: Apply migration to Supabase**

Use the same migration path as prior repo work. If Supabase MCP is available, apply the SQL above as migration name `0004_outlook_email_import`. If MCP is unavailable, paste it in the Supabase SQL editor and run it once.

Expected: both tables and both unique indexes are created.

- [ ] **Step 3: Verify migration**

Run a Supabase table query or SQL editor check:

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('outlook_connections', 'outlook_imported_messages')
order by table_name;
```

Expected rows:

```text
outlook_connections
outlook_imported_messages
```

- [ ] **Step 4: Commit migration**

```bash
git add docs/backend/migrations/0004_outlook_email_import.sql
git commit -m "feat: add outlook import tables"
```

---

## Task 3: Config, Crypto, And Candidate Signing

**Files:**
- Create: `src/lib/outlook/config.ts`
- Create: `src/lib/outlook/crypto.ts`
- Create: `src/lib/outlook/candidate-signing.ts`
- Test: `tests/unit/outlook/config.test.ts`
- Test: `tests/unit/outlook/crypto.test.ts`
- Test: `tests/unit/outlook/candidate-signing.test.ts`

- [ ] **Step 1: Write failing config tests**

Create `tests/unit/outlook/config.test.ts`:

```ts
import { afterEach, describe, expect, test, vi } from 'vitest';

const originalEnv = process.env;

async function loadConfig() {
  vi.resetModules();
  return import('@/lib/outlook/config');
}

describe('outlook config', () => {
  afterEach(() => {
    process.env = originalEnv;
    vi.unstubAllEnvs();
  });

  test('reads complete outlook config', async () => {
    vi.stubEnv('MICROSOFT_CLIENT_ID', 'client-id');
    vi.stubEnv('MICROSOFT_CLIENT_SECRET', 'client-secret');
    vi.stubEnv('MICROSOFT_TENANT', 'common');
    vi.stubEnv('MICROSOFT_REDIRECT_URI', 'http://localhost:3000/api/outlook/oauth/callback');
    vi.stubEnv('OUTLOOK_TOKEN_ENCRYPTION_KEY', 'abcdefghijklmnopqrstuvwxyz1234567890ABCDE');
    vi.stubEnv('OUTLOOK_SCAN_SIGNING_SECRET', 'signing-secret');

    const { getOutlookConfig } = await loadConfig();

    expect(getOutlookConfig()).toMatchObject({
      clientId: 'client-id',
      tenant: 'common',
      redirectUri: 'http://localhost:3000/api/outlook/oauth/callback',
      scopes: ['openid', 'profile', 'offline_access', 'Mail.Read'],
    });
  });

  test('throws with missing env names', async () => {
    process.env = {};
    const { getOutlookConfig } = await loadConfig();

    expect(() => getOutlookConfig()).toThrow(/MICROSOFT_CLIENT_ID/);
    expect(() => getOutlookConfig()).toThrow(/OUTLOOK_SCAN_SIGNING_SECRET/);
  });
});
```

Run:

```bash
pnpm exec vitest run tests/unit/outlook/config.test.ts
```

Expected: FAIL because `src/lib/outlook/config.ts` does not exist.

- [ ] **Step 2: Implement config**

Create `src/lib/outlook/config.ts`:

```ts
import 'server-only';

export type OutlookConfig = {
  clientId: string;
  clientSecret: string;
  tenant: string;
  redirectUri: string;
  tokenEncryptionKey: string;
  scanSigningSecret: string;
  scopes: string[];
};

const scopeList = ['openid', 'profile', 'offline_access', 'Mail.Read'];

export function getOutlookConfig(): OutlookConfig {
  const env = {
    clientId: process.env.MICROSOFT_CLIENT_ID,
    clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
    tenant: process.env.MICROSOFT_TENANT || 'common',
    redirectUri: process.env.MICROSOFT_REDIRECT_URI,
    tokenEncryptionKey: process.env.OUTLOOK_TOKEN_ENCRYPTION_KEY,
    scanSigningSecret: process.env.OUTLOOK_SCAN_SIGNING_SECRET,
  };
  const missing = Object.entries(env)
    .filter(([, value]) => !value)
    .map(([key]) => key);
  if (missing.length > 0) {
    const names: Record<string, string> = {
      clientId: 'MICROSOFT_CLIENT_ID',
      clientSecret: 'MICROSOFT_CLIENT_SECRET',
      tenant: 'MICROSOFT_TENANT',
      redirectUri: 'MICROSOFT_REDIRECT_URI',
      tokenEncryptionKey: 'OUTLOOK_TOKEN_ENCRYPTION_KEY',
      scanSigningSecret: 'OUTLOOK_SCAN_SIGNING_SECRET',
    };
    throw new Error(`Missing Outlook env: ${missing.map((name) => names[name]).join(', ')}`);
  }
  return {
    clientId: env.clientId!,
    clientSecret: env.clientSecret!,
    tenant: env.tenant!,
    redirectUri: env.redirectUri!,
    tokenEncryptionKey: env.tokenEncryptionKey!,
    scanSigningSecret: env.scanSigningSecret!,
    scopes: scopeList,
  };
}
```

Run:

```bash
pnpm exec vitest run tests/unit/outlook/config.test.ts
```

Expected: PASS.

- [ ] **Step 3: Write failing crypto and signing tests**

Create `tests/unit/outlook/crypto.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import { decryptToken, encryptToken } from '@/lib/outlook/crypto';

describe('outlook token crypto', () => {
  test('round trips refresh tokens without exposing plaintext', () => {
    const encrypted = encryptToken('refresh-token-123', 'abcdefghijklmnopqrstuvwxyz123456');

    expect(encrypted.ciphertext).not.toContain('refresh-token-123');
    expect(encrypted.iv).toBeTruthy();
    expect(encrypted.tag).toBeTruthy();
    expect(decryptToken(encrypted, 'abcdefghijklmnopqrstuvwxyz123456')).toBe('refresh-token-123');
  });
});
```

Create `tests/unit/outlook/candidate-signing.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import {
  signImportCandidate,
  verifyImportCandidate,
  type UnsignedImportCandidate,
} from '@/lib/outlook/candidate-signing';

const candidate: UnsignedImportCandidate = {
  messageId: 'message-1',
  internetMessageId: '<internet-1@example.com>',
  subject: 'Thanks for applying to Senior Engineer',
  fromName: 'Greenhouse',
  fromAddress: 'no-reply@greenhouse.io',
  receivedAt: '2026-07-07T10:00:00.000Z',
  webLink: 'https://outlook.office.com/mail/message-1',
  bodyPreview: 'We received your application.',
  confidence: 'high',
  score: 92,
  reasons: ['application received phrase', 'ats sender'],
  extracted: {
    companyName: 'Acme',
    role: 'Senior Engineer',
    source: 'Outlook',
    applied: '2026-07-07',
    postingUrl: 'https://jobs.example.com/123',
  },
};

describe('candidate signing', () => {
  test('verifies untampered candidates', () => {
    const signed = signImportCandidate(candidate, 'secret');

    expect(verifyImportCandidate(signed, 'secret')).toEqual(candidate);
  });

  test('rejects tampered candidates', () => {
    const signed = signImportCandidate(candidate, 'secret');
    const tampered = { ...signed, payload: { ...signed.payload, score: 1 } };

    expect(() => verifyImportCandidate(tampered, 'secret')).toThrow(/signature/);
  });
});
```

Run:

```bash
pnpm exec vitest run tests/unit/outlook/crypto.test.ts tests/unit/outlook/candidate-signing.test.ts
```

Expected: FAIL because modules do not exist.

- [ ] **Step 4: Implement crypto and signing**

Create `src/lib/outlook/crypto.ts`:

```ts
import 'server-only';

import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

export type EncryptedToken = {
  ciphertext: string;
  iv: string;
  tag: string;
};

function keyBytes(secret: string): Buffer {
  return createHash('sha256').update(secret).digest();
}

export function encryptToken(token: string, secret: string): EncryptedToken {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', keyBytes(secret), iv);
  const ciphertext = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    ciphertext: ciphertext.toString('base64url'),
    iv: iv.toString('base64url'),
    tag: tag.toString('base64url'),
  };
}

export function decryptToken(encrypted: EncryptedToken, secret: string): string {
  const decipher = createDecipheriv(
    'aes-256-gcm',
    keyBytes(secret),
    Buffer.from(encrypted.iv, 'base64url'),
  );
  decipher.setAuthTag(Buffer.from(encrypted.tag, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(encrypted.ciphertext, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}
```

Create `src/lib/outlook/candidate-signing.ts`:

```ts
import 'server-only';

import { createHmac, timingSafeEqual } from 'node:crypto';

export type ImportConfidence = 'high' | 'medium' | 'low';

export type ExtractedApplicationFields = {
  companyName: string;
  role: string;
  source: string;
  applied: string;
  postingUrl?: string | undefined;
  location?: string | undefined;
  description?: string | undefined;
};

export type UnsignedImportCandidate = {
  messageId: string;
  internetMessageId?: string | undefined;
  subject: string;
  fromName: string;
  fromAddress: string;
  receivedAt: string;
  webLink?: string | undefined;
  bodyPreview: string;
  confidence: ImportConfidence;
  score: number;
  reasons: string[];
  extracted: ExtractedApplicationFields;
};

export type SignedImportCandidate = {
  payload: UnsignedImportCandidate;
  signature: string;
};

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
    .join(',')}}`;
}

function signatureFor(payload: UnsignedImportCandidate, secret: string): string {
  return createHmac('sha256', secret).update(stableStringify(payload)).digest('base64url');
}

export function signImportCandidate(
  payload: UnsignedImportCandidate,
  secret: string,
): SignedImportCandidate {
  return { payload, signature: signatureFor(payload, secret) };
}

export function verifyImportCandidate(
  signed: SignedImportCandidate,
  secret: string,
): UnsignedImportCandidate {
  const expected = Buffer.from(signatureFor(signed.payload, secret));
  const actual = Buffer.from(signed.signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    throw new Error('Invalid Outlook import candidate signature');
  }
  return signed.payload;
}
```

Run:

```bash
pnpm exec vitest run tests/unit/outlook/config.test.ts tests/unit/outlook/crypto.test.ts tests/unit/outlook/candidate-signing.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/outlook/config.ts src/lib/outlook/crypto.ts src/lib/outlook/candidate-signing.ts tests/unit/outlook/config.test.ts tests/unit/outlook/crypto.test.ts tests/unit/outlook/candidate-signing.test.ts
git commit -m "feat: add outlook config and signing primitives"
```

---

## Task 4: Microsoft OAuth State And Token Client

**Files:**
- Create: `src/lib/outlook/oauth-state.ts`
- Create: `src/lib/outlook/oauth.ts`
- Test: `tests/unit/outlook/oauth-state.test.ts`
- Test: `tests/unit/outlook/oauth.test.ts`

- [ ] **Step 1: Write failing OAuth tests**

Create `tests/unit/outlook/oauth.test.ts`:

```ts
import { describe, expect, test, vi } from 'vitest';
import { buildAuthorizationUrl, exchangeAuthorizationCode, refreshAccessToken } from '@/lib/outlook/oauth';

const config = {
  clientId: 'client-id',
  clientSecret: 'client-secret',
  tenant: 'common',
  redirectUri: 'http://localhost:3000/api/outlook/oauth/callback',
  tokenEncryptionKey: 'encrypt',
  scanSigningSecret: 'sign',
  scopes: ['openid', 'profile', 'offline_access', 'Mail.Read'],
};

describe('outlook oauth client', () => {
  test('builds Microsoft authorization URL', () => {
    const url = new URL(buildAuthorizationUrl(config, 'state-123'));

    expect(url.origin).toBe('https://login.microsoftonline.com');
    expect(url.pathname).toBe('/common/oauth2/v2.0/authorize');
    expect(url.searchParams.get('client_id')).toBe('client-id');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('scope')).toBe('openid profile offline_access Mail.Read');
    expect(url.searchParams.get('state')).toBe('state-123');
  });

  test('exchanges authorization code for tokens', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({
        token_type: 'Bearer',
        scope: 'Mail.Read offline_access',
        access_token: 'access-token',
        refresh_token: 'refresh-token',
        expires_in: 3600,
        id_token: 'id-token',
      })),
    );

    await expect(exchangeAuthorizationCode(config, 'code-1')).resolves.toMatchObject({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    });
  });

  test('refreshes access token', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({
        token_type: 'Bearer',
        scope: 'Mail.Read offline_access',
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        expires_in: 3600,
      })),
    );

    await expect(refreshAccessToken(config, 'refresh-token')).resolves.toMatchObject({
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
    });
  });
});
```

Run:

```bash
pnpm exec vitest run tests/unit/outlook/oauth.test.ts
```

Expected: FAIL because `src/lib/outlook/oauth.ts` does not exist.

- [ ] **Step 2: Implement OAuth client**

Create `src/lib/outlook/oauth.ts`:

```ts
import 'server-only';

import type { OutlookConfig } from '@/lib/outlook/config';

export type TokenResponse = {
  accessToken: string;
  refreshToken: string;
  scope: string;
  expiresIn: number;
};

type MicrosoftTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  scope?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
};

function tokenUrl(config: OutlookConfig): string {
  return `https://login.microsoftonline.com/${config.tenant}/oauth2/v2.0/token`;
}

export function buildAuthorizationUrl(config: OutlookConfig, state: string): string {
  const url = new URL(`https://login.microsoftonline.com/${config.tenant}/oauth2/v2.0/authorize`);
  url.searchParams.set('client_id', config.clientId);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('redirect_uri', config.redirectUri);
  url.searchParams.set('response_mode', 'query');
  url.searchParams.set('scope', config.scopes.join(' '));
  url.searchParams.set('state', state);
  return url.toString();
}

async function postToken(config: OutlookConfig, body: URLSearchParams): Promise<TokenResponse> {
  body.set('client_id', config.clientId);
  body.set('client_secret', config.clientSecret);
  body.set('redirect_uri', config.redirectUri);
  const response = await fetch(tokenUrl(config), {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });
  const json = (await response.json().catch(() => ({}))) as MicrosoftTokenResponse;
  if (!response.ok || !json.access_token || !json.refresh_token) {
    throw new Error(json.error_description || json.error || 'Microsoft token request failed');
  }
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    scope: json.scope || config.scopes.join(' '),
    expiresIn: json.expires_in || 0,
  };
}

export function exchangeAuthorizationCode(config: OutlookConfig, code: string): Promise<TokenResponse> {
  return postToken(
    config,
    new URLSearchParams({
      grant_type: 'authorization_code',
      code,
    }),
  );
}

export function refreshAccessToken(config: OutlookConfig, refreshToken: string): Promise<TokenResponse> {
  return postToken(
    config,
    new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      scope: config.scopes.join(' '),
    }),
  );
}
```

Run:

```bash
pnpm exec vitest run tests/unit/outlook/oauth.test.ts
```

Expected: PASS.

- [ ] **Step 3: Write and implement OAuth state helpers**

Create `tests/unit/outlook/oauth-state.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import { createOAuthState, verifyOAuthState } from '@/lib/outlook/oauth-state';

describe('outlook oauth state', () => {
  test('round trips signed state before expiry', () => {
    const state = createOAuthState('secret', 1_000);

    expect(verifyOAuthState(state, 'secret', Date.now() + 500)).toBe(true);
  });

  test('rejects expired state', () => {
    const state = createOAuthState('secret', 1_000, 1000);

    expect(verifyOAuthState(state, 'secret', 3000)).toBe(false);
  });
});
```

Create `src/lib/outlook/oauth-state.ts`:

```ts
import 'server-only';

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

type StatePayload = {
  nonce: string;
  expiresAt: number;
};

function sign(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

export function createOAuthState(secret: string, ttlMs = 10 * 60 * 1000, now = Date.now()): string {
  const payload: StatePayload = {
    nonce: randomBytes(16).toString('base64url'),
    expiresAt: now + ttlMs,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${encoded}.${sign(encoded, secret)}`;
}

export function verifyOAuthState(state: string, secret: string, now = Date.now()): boolean {
  const [encoded, actual] = state.split('.');
  if (!encoded || !actual) return false;
  const expected = Buffer.from(sign(encoded, secret));
  const received = Buffer.from(actual);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return false;
  const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as StatePayload;
  return payload.expiresAt >= now;
}
```

Run:

```bash
pnpm exec vitest run tests/unit/outlook/oauth.test.ts tests/unit/outlook/oauth-state.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/lib/outlook/oauth.ts src/lib/outlook/oauth-state.ts tests/unit/outlook/oauth.test.ts tests/unit/outlook/oauth-state.test.ts
git commit -m "feat: add outlook oauth client"
```

---

## Task 5: Outlook Supabase Repository

**Files:**
- Create: `src/lib/repositories/supabase/outlook-repository.ts`
- Test: `tests/unit/repositories/outlook-repository.test.ts`

- [ ] **Step 1: Write failing repository tests**

Create `tests/unit/repositories/outlook-repository.test.ts` with mocked Supabase admin calls following the style in `tests/unit/repositories/apps-repository.test.ts`. Cover these behaviors:

```ts
import { describe, expect, test, vi } from 'vitest';

vi.mock('@/lib/server/owner', () => ({ getOwnerUserId: () => 'owner-1' }));

describe('outlook repository', () => {
  test('saves encrypted connection pinned to owner', async () => {
    const upsert = vi.fn(() => ({ error: null }));
    vi.doMock('@/lib/supabase/admin', () => ({
      getSupabaseAdminClient: () => ({ from: () => ({ upsert }) }),
    }));
    const { saveOutlookConnection } = await import('@/lib/repositories/supabase/outlook-repository');

    await saveOutlookConnection({
      email: 'me@example.com',
      refreshTokenCiphertext: 'cipher',
      refreshTokenIv: 'iv',
      refreshTokenTag: 'tag',
      scope: 'Mail.Read',
    });

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        owner_user_id: 'owner-1',
        email: 'me@example.com',
        refresh_token_ciphertext: 'cipher',
      }),
      { onConflict: 'owner_user_id' },
    );
  });
});
```

Run:

```bash
pnpm exec vitest run tests/unit/repositories/outlook-repository.test.ts
```

Expected: FAIL because the repository does not exist.

- [ ] **Step 2: Implement repository**

Create `src/lib/repositories/supabase/outlook-repository.ts`:

```ts
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
```

Run:

```bash
pnpm exec vitest run tests/unit/repositories/outlook-repository.test.ts
```

Expected: PASS. Before committing, extend `tests/unit/repositories/outlook-repository.test.ts` with assertions that `getOutlookConnection()` returns `null` for no row, `listImportedMessageIds()` returns both `message_id` and `internet_message_id`, and `recordImportedMessages()` upserts rows with `owner_user_id: 'owner-1'`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/repositories/supabase/outlook-repository.ts tests/unit/repositories/outlook-repository.test.ts
git commit -m "feat: persist outlook connections and imports"
```

---

## Task 6: Graph Client And Parser

**Files:**
- Create: `src/lib/outlook/graph.ts`
- Create: `src/lib/outlook/parser.ts`
- Test: `tests/unit/outlook/graph.test.ts`
- Test: `tests/unit/outlook/parser.test.ts`

- [ ] **Step 1: Write failing parser tests**

Create `tests/unit/outlook/parser.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import { parseApplicationEmail } from '@/lib/outlook/parser';

describe('outlook application parser', () => {
  test('detects high-confidence Greenhouse confirmation', () => {
    const result = parseApplicationEmail({
      id: '1',
      internetMessageId: '<1@example.com>',
      subject: 'Thank you for applying to Senior Backend Engineer at Acme',
      receivedDateTime: '2026-07-07T12:00:00.000Z',
      from: { emailAddress: { name: 'Acme Recruiting', address: 'no-reply@greenhouse.io' } },
      bodyPreview: 'We received your application and our hiring team will review it.',
      webLink: 'https://outlook.office.com/mail/1',
      body: { contentType: 'html', content: '<p>Thank you for applying.</p><a href="https://boards.greenhouse.io/acme/jobs/123">Job posting</a>' },
    });

    expect(result?.confidence).toBe('high');
    expect(result?.extracted.companyName).toBe('Acme');
    expect(result?.extracted.role).toBe('Senior Backend Engineer');
    expect(result?.reasons).toContain('application confirmation phrase');
  });

  test('rejects job alerts', () => {
    const result = parseApplicationEmail({
      id: '2',
      subject: '10 new jobs for backend engineer',
      receivedDateTime: '2026-07-07T12:00:00.000Z',
      from: { emailAddress: { name: 'LinkedIn Jobs', address: 'jobs-noreply@linkedin.com' } },
      bodyPreview: 'New jobs matching your search.',
    });

    expect(result).toBeNull();
  });
});
```

Run:

```bash
pnpm exec vitest run tests/unit/outlook/parser.test.ts
```

Expected: FAIL because parser does not exist.

- [ ] **Step 2: Implement parser**

Create `src/lib/outlook/parser.ts`:

```ts
import type { UnsignedImportCandidate } from '@/lib/outlook/candidate-signing';

export type GraphMessage = {
  id: string;
  internetMessageId?: string | undefined;
  subject?: string | undefined;
  receivedDateTime: string;
  from?: { emailAddress?: { name?: string | undefined; address?: string | undefined } } | undefined;
  bodyPreview?: string | undefined;
  webLink?: string | undefined;
  body?: { contentType?: string | undefined; content?: string | undefined } | undefined;
};

const positivePhrases = [
  'thank you for applying',
  'thanks for applying',
  'application received',
  'received your application',
  'we received your application',
  'your application for',
  'your application to',
];

const rejectPhrases = ['new jobs', 'job alert', 'recommended jobs', 'saved search', 'newsletter'];
const atsDomains = ['greenhouse.io', 'lever.co', 'ashbyhq.com', 'workday.com', 'smartrecruiters.com'];

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function textOf(message: GraphMessage): string {
  return [message.subject, message.bodyPreview, stripHtml(message.body?.content ?? '')]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function extractCompanyAndRole(subject: string, fromName: string): { companyName: string; role: string } {
  const applyingTo = subject.match(/applying to\s+(.+?)\s+at\s+(.+)$/i);
  if (applyingTo) return { role: applyingTo[1]!.trim(), companyName: applyingTo[2]!.trim() };
  const applicationFor = subject.match(/application for\s+(.+?)\s+(?:at|with)\s+(.+)$/i);
  if (applicationFor) return { role: applicationFor[1]!.trim(), companyName: applicationFor[2]!.trim() };
  const cleanedCompany = fromName.replace(/\s*(recruiting|careers|talent|jobs)\s*$/i, '').trim();
  return { role: 'New application', companyName: cleanedCompany || 'Unknown company' };
}

function firstUrl(content: string): string | undefined {
  return content.match(/https?:\/\/[^\s"')<>]+/)?.[0];
}

export function parseApplicationEmail(message: GraphMessage): UnsignedImportCandidate | null {
  const subject = message.subject ?? '';
  const fromName = message.from?.emailAddress?.name ?? '';
  const fromAddress = message.from?.emailAddress?.address ?? '';
  const haystack = textOf(message);
  if (rejectPhrases.some((phrase) => haystack.includes(phrase))) return null;

  const reasons: string[] = [];
  let score = 0;
  if (positivePhrases.some((phrase) => haystack.includes(phrase))) {
    score += 60;
    reasons.push('application confirmation phrase');
  }
  if (atsDomains.some((domain) => fromAddress.toLowerCase().includes(domain))) {
    score += 20;
    reasons.push('ats sender');
  }
  if (subject.toLowerCase().includes('application')) score += 10;
  if (score < 45) return null;

  const extracted = extractCompanyAndRole(subject, fromName);
  const bodyContent = message.body?.content ?? '';
  const postingUrl = firstUrl(bodyContent);
  const confidence = score >= 75 ? 'high' : score >= 55 ? 'medium' : 'low';
  return {
    messageId: message.id,
    ...(message.internetMessageId ? { internetMessageId: message.internetMessageId } : {}),
    subject,
    fromName,
    fromAddress,
    receivedAt: message.receivedDateTime,
    ...(message.webLink ? { webLink: message.webLink } : {}),
    bodyPreview: message.bodyPreview ?? '',
    confidence,
    score,
    reasons,
    extracted: {
      companyName: extracted.companyName,
      role: extracted.role,
      source: 'Outlook',
      applied: message.receivedDateTime.slice(0, 10),
      ...(postingUrl ? { postingUrl } : {}),
      description: stripHtml(bodyContent).slice(0, 1200),
    },
  };
}
```

Run:

```bash
pnpm exec vitest run tests/unit/outlook/parser.test.ts
```

Expected: PASS.

- [ ] **Step 3: Write and implement Graph client**

Create `tests/unit/outlook/graph.test.ts`:

```ts
import { describe, expect, test, vi } from 'vitest';
import { listRecentInboxMessages } from '@/lib/outlook/graph';

describe('outlook graph client', () => {
  test('queries recent inbox messages with bounded select', async () => {
    const fetchMock = vi.fn(async () => Response.json({ value: [{ id: '1', receivedDateTime: '2026-07-07T00:00:00.000Z' }] }));
    vi.stubGlobal('fetch', fetchMock);

    const messages = await listRecentInboxMessages('token', new Date('2026-07-07T00:00:00.000Z'));

    const url = new URL(String(fetchMock.mock.calls[0]![0]));
    expect(url.pathname).toBe('/v1.0/me/mailFolders/inbox/messages');
    expect(url.searchParams.get('$top')).toBe('50');
    expect(url.searchParams.get('$select')).toContain('bodyPreview');
    expect(url.searchParams.get('$filter')).toContain('2026-07-04T00:00:00.000Z');
    expect(messages).toHaveLength(1);
  });
});
```

Create `src/lib/outlook/graph.ts`:

```ts
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
  const json = (await response.json().catch(() => ({}))) as { value?: GraphMessage[]; error?: { message?: string } };
  if (!response.ok) {
    throw new Error(json.error?.message || 'Microsoft Graph messages request failed');
  }
  return json.value ?? [];
}
```

Run:

```bash
pnpm exec vitest run tests/unit/outlook/graph.test.ts tests/unit/outlook/parser.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/lib/outlook/graph.ts src/lib/outlook/parser.ts tests/unit/outlook/graph.test.ts tests/unit/outlook/parser.test.ts
git commit -m "feat: parse outlook application emails"
```

---

## Task 7: Scan Service

**Files:**
- Create: `src/lib/outlook/scan.ts`
- Test: `tests/unit/outlook/scan.test.ts`

- [ ] **Step 1: Write failing scan service test**

Create `tests/unit/outlook/scan.test.ts`:

```ts
import { describe, expect, test, vi } from 'vitest';

vi.mock('@/lib/outlook/config', () => ({
  getOutlookConfig: () => ({
    clientId: 'client',
    clientSecret: 'secret',
    tenant: 'common',
    redirectUri: 'http://localhost/callback',
    tokenEncryptionKey: 'abcdefghijklmnopqrstuvwxyz123456',
    scanSigningSecret: 'signing-secret',
    scopes: ['openid', 'profile', 'offline_access', 'Mail.Read'],
  }),
}));
vi.mock('@/lib/repositories/supabase/outlook-repository', () => ({
  getOutlookConnection: vi.fn(async () => ({
    email: 'me@example.com',
    refreshTokenCiphertext: 'cipher',
    refreshTokenIv: 'iv',
    refreshTokenTag: 'tag',
    scope: 'Mail.Read',
  })),
  listImportedMessageIds: vi.fn(async () => new Set(['already-imported'])),
}));
vi.mock('@/lib/outlook/crypto', () => ({ decryptToken: () => 'refresh-token' }));
vi.mock('@/lib/outlook/oauth', () => ({ refreshAccessToken: vi.fn(async () => ({ accessToken: 'access-token', refreshToken: 'refresh-token-2', scope: 'Mail.Read', expiresIn: 3600 })) }));
vi.mock('@/lib/outlook/graph', () => ({
  listRecentInboxMessages: vi.fn(async () => [
    {
      id: 'message-1',
      subject: 'Thank you for applying to Staff Engineer at Acme',
      receivedDateTime: '2026-07-07T00:00:00.000Z',
      from: { emailAddress: { name: 'Acme Recruiting', address: 'no-reply@greenhouse.io' } },
      bodyPreview: 'We received your application.',
    },
    {
      id: 'already-imported',
      subject: 'Thank you for applying to Old Role at Acme',
      receivedDateTime: '2026-07-07T00:00:00.000Z',
      from: { emailAddress: { name: 'Acme Recruiting', address: 'no-reply@greenhouse.io' } },
      bodyPreview: 'We received your application.',
    },
  ]),
}));

describe('scanOutlookApplications', () => {
  test('returns signed candidates excluding already imported messages', async () => {
    const { scanOutlookApplications } = await import('@/lib/outlook/scan');

    const result = await scanOutlookApplications();

    expect(result.connectedEmail).toBe('me@example.com');
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]!.payload.messageId).toBe('message-1');
    expect(result.candidates[0]!.signature).toBeTruthy();
  });
});
```

Run:

```bash
pnpm exec vitest run tests/unit/outlook/scan.test.ts
```

Expected: FAIL because `scan.ts` does not exist.

- [ ] **Step 2: Implement scan service**

Create `src/lib/outlook/scan.ts`:

```ts
import 'server-only';

import { signImportCandidate, type SignedImportCandidate } from '@/lib/outlook/candidate-signing';
import { getOutlookConfig } from '@/lib/outlook/config';
import { decryptToken } from '@/lib/outlook/crypto';
import { listRecentInboxMessages } from '@/lib/outlook/graph';
import { refreshAccessToken } from '@/lib/outlook/oauth';
import { parseApplicationEmail } from '@/lib/outlook/parser';
import { getOutlookConnection, listImportedMessageIds } from '@/lib/repositories/supabase/outlook-repository';

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
    .filter((message) => !importedIds.has(message.id) && !importedIds.has(message.internetMessageId ?? ''))
    .map(parseApplicationEmail)
    .filter((candidate): candidate is NonNullable<typeof candidate> => Boolean(candidate))
    .sort((a, b) => b.score - a.score || b.receivedAt.localeCompare(a.receivedAt))
    .map((candidate) => signImportCandidate(candidate, config.scanSigningSecret));

  return { connectedEmail: connection.email, candidates };
}
```

Run:

```bash
pnpm exec vitest run tests/unit/outlook/scan.test.ts
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/outlook/scan.ts tests/unit/outlook/scan.test.ts
git commit -m "feat: scan outlook for application candidates"
```

---

## Task 8: Server Card Factory And Import Service

**Files:**
- Create: `src/lib/applications/server-card-factory.ts`
- Create: `src/lib/outlook/import.ts`
- Test: `tests/unit/applications/server-card-factory.test.ts`
- Test: `tests/unit/outlook/import.test.ts`

- [ ] **Step 1: Write failing card factory test**

Create `tests/unit/applications/server-card-factory.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import { DEMO_USER_ID } from '@/lib/types';
import { createServerApplicationBundle } from '@/lib/applications/server-card-factory';

describe('createServerApplicationBundle', () => {
  test('creates applied application with normal card defaults', () => {
    const bundle = createServerApplicationBundle({
      companyName: 'Acme',
      role: 'Staff Backend Engineer',
      applied: '2026-07-07',
      source: 'Outlook',
      postingUrl: 'https://jobs.example.com/123',
      description: 'We received your application.',
    });

    expect(bundle.application.ownerUserId).toBe(DEMO_USER_ID);
    expect(bundle.application.status).toBe('applied');
    expect(bundle.application.companyName).toBe('Acme');
    expect(bundle.application.role).toBe('Staff Backend Engineer');
    expect(bundle.application.source).toBe('Outlook');
    expect(bundle.application.applied).toBe('2026-07-07');
    expect(bundle.activity?.history[0]?.text).toContain('Imported from Outlook');
  });
});
```

Run:

```bash
pnpm exec vitest run tests/unit/applications/server-card-factory.test.ts
```

Expected: FAIL because factory does not exist.

- [ ] **Step 2: Implement server card factory**

Create `src/lib/applications/server-card-factory.ts`:

```ts
import 'server-only';

import { slugifyCompanyId } from '@/lib/company-utils';
import type { AppBundle } from '@/lib/repositories/supabase/apps-repository';
import { DEMO_USER_ID, type Application } from '@/lib/types';

export type ServerApplicationInput = {
  companyName: string;
  role: string;
  applied: string;
  source: string;
  postingUrl?: string | undefined;
  location?: string | undefined;
  description?: string | undefined;
};

function displayId(): string {
  return `JT-${Date.now().toString(36).toUpperCase()}`;
}

export function createServerApplicationBundle(input: ServerApplicationInput): AppBundle {
  const now = new Date().toISOString();
  const application: Application = {
    id: crypto.randomUUID(),
    ownerUserId: DEMO_USER_ID,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    displayId: displayId(),
    status: 'applied',
    company: slugifyCompanyId(input.companyName),
    companyName: input.companyName.trim(),
    role: input.role.trim(),
    location: input.location?.trim() || 'Remote',
    remote: 'Remote',
    salaryMin: 0,
    salaryMax: 0,
    level: 'Senior',
    team: 'Product',
    posted: input.applied,
    applied: input.applied,
    lastActivity: now,
    priority: 'med',
    source: input.source,
    progress: 20,
    tags: ['Outlook'],
    sourceListingId: null,
    sortIndex: 0,
    archivedAt: null,
    ...(input.postingUrl ? { postingUrl: input.postingUrl } : {}),
    ...(input.description ? { description: input.description } : {}),
  };
  return {
    application,
    activity: {
      comments: [],
      links: input.postingUrl
        ? [{ id: crypto.randomUUID(), type: 'posting', title: 'Original posting', meta: input.postingUrl }]
        : [],
      attachments: [],
      history: [
        {
          id: crypto.randomUUID(),
          type: 'created',
          who: 'me',
          when: now,
          text: 'Imported from Outlook application confirmation',
        },
      ],
    },
  };
}
```

Run:

```bash
pnpm exec vitest run tests/unit/applications/server-card-factory.test.ts
```

Expected: PASS.

- [ ] **Step 3: Write and implement import service**

Create `tests/unit/outlook/import.test.ts`:

```ts
import { describe, expect, test, vi } from 'vitest';
import { signImportCandidate, type UnsignedImportCandidate } from '@/lib/outlook/candidate-signing';

vi.mock('@/lib/outlook/config', () => ({
  getOutlookConfig: () => ({
    clientId: 'client',
    clientSecret: 'secret',
    tenant: 'common',
    redirectUri: 'http://localhost/callback',
    tokenEncryptionKey: 'encrypt',
    scanSigningSecret: 'secret',
    scopes: ['openid', 'profile', 'offline_access', 'Mail.Read'],
  }),
}));

const upsertBundles = vi.fn(async () => undefined);
const recordImportedMessages = vi.fn(async () => undefined);
vi.mock('@/lib/repositories/supabase/apps-repository', () => ({ upsertBundles }));
vi.mock('@/lib/repositories/supabase/outlook-repository', () => ({ recordImportedMessages }));

const candidate: UnsignedImportCandidate = {
  messageId: 'message-1',
  subject: 'Thank you for applying to Staff Engineer at Acme',
  fromName: 'Acme',
  fromAddress: 'no-reply@greenhouse.io',
  receivedAt: '2026-07-07T12:00:00.000Z',
  bodyPreview: 'We received your application.',
  confidence: 'high',
  score: 90,
  reasons: ['application confirmation phrase'],
  extracted: {
    companyName: 'Acme',
    role: 'Staff Engineer',
    source: 'Outlook',
    applied: '2026-07-07',
  },
};

describe('importOutlookCandidates', () => {
  test('verifies signed candidates, creates bundles, records imports', async () => {
    const { importOutlookCandidates } = await import('@/lib/outlook/import');
    const result = await importOutlookCandidates([signImportCandidate(candidate, 'secret')]);

    expect(result.imported).toHaveLength(1);
    expect(upsertBundles).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ application: expect.objectContaining({ role: 'Staff Engineer' }) })]));
    expect(recordImportedMessages).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ messageId: 'message-1', role: 'Staff Engineer' })]));
  });
});
```

Create `src/lib/outlook/import.ts`:

```ts
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
```

Run:

```bash
pnpm exec vitest run tests/unit/applications/server-card-factory.test.ts tests/unit/outlook/import.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/lib/applications/server-card-factory.ts src/lib/outlook/import.ts tests/unit/applications/server-card-factory.test.ts tests/unit/outlook/import.test.ts
git commit -m "feat: import outlook candidates as applications"
```

---

## Task 9: Outlook API Routes

**Files:**
- Create: `src/app/api/outlook/oauth/start/route.ts`
- Create: `src/app/api/outlook/oauth/callback/route.ts`
- Create: `src/app/api/outlook/status/route.ts`
- Create: `src/app/api/outlook/scan/route.ts`
- Create: `src/app/api/outlook/import/route.ts`
- Test: `tests/unit/api/outlook/routes.test.ts`

- [ ] **Step 1: Re-read current route handler docs**

Run the docs check from Task 0. If local docs are missing, open official current Next.js App Router route-handler docs. Note whether `cookies()` is sync or async in this Next version before writing code.

Expected: route code uses the documented API for Next 15.5.18.

- [ ] **Step 2: Implement routes**

Route shape:

```ts
// all route files
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
```

Create `oauth/start` route that:

1. calls `getOutlookConfig()`
2. creates signed state with `createOAuthState(config.scanSigningSecret)`
3. stores it in an `outlook_oauth_state` httpOnly sameSite lax cookie for 10 minutes
4. redirects to `buildAuthorizationUrl(config, state)`

Create `oauth/callback` route that:

1. reads `code` and `state` from `request.url`
2. validates `state` against the cookie with `verifyOAuthState`
3. exchanges code with `exchangeAuthorizationCode`
4. encrypts refresh token with `encryptToken`
5. saves the connection with `saveOutlookConnection`
6. redirects to `/?outlook=connected`

Create `status` route that returns:

```json
{ "connected": true, "email": "me@example.com" }
```

or:

```json
{ "connected": false, "email": null }
```

Create `scan` route that returns:

```json
{ "connectedEmail": "me@example.com", "candidates": [] }
```

Create `import` route that accepts:

```json
{ "candidates": [{ "payload": {}, "signature": "..." }] }
```

and returns the `importOutlookCandidates()` result.

- [ ] **Step 3: Add route tests with module mocks**

Create `tests/unit/api/outlook/routes.test.ts` that imports route modules with `vi.doMock` for services and verifies:

```ts
expect((await status.GET()).status).toBe(200);
expect(await (await status.GET()).json()).toEqual({ connected: false, email: null });
expect(await (await scan.POST()).json()).toMatchObject({ candidates: [] });
expect(await (await importRoute.POST(new Request('http://test', { method: 'POST', body: JSON.stringify({ candidates: [] }) }))).json()).toEqual({ imported: [] });
```

Run:

```bash
pnpm exec vitest run tests/unit/api/outlook/routes.test.ts
```

Expected: PASS.

- [ ] **Step 4: Real Azure callback smoke**

Start local dev with local env:

```bash
NEXT_PUBLIC_PERSISTENCE_ADAPTER=supabase pnpm run dev
```

Open:

```text
http://localhost:3000/api/outlook/oauth/start
```

Expected:

1. Browser redirects to Microsoft login/consent.
2. Consent asks for read mail access.
3. Callback lands on `http://localhost:3000/?outlook=connected`.
4. Supabase `outlook_connections` has one row for `DEMO_USER_ID`.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/outlook tests/unit/api/outlook/routes.test.ts
git commit -m "feat: expose outlook oauth and import routes"
```

---

## Task 10: Inbox-Style Review Modal UI

**Files:**
- Create: `src/components/jobtracker/OutlookImportDialog.tsx`
- Modify: `src/components/jobtracker/JobTrackerApp.tsx`
- Test: `tests/unit/components/outlook-import-dialog.test.tsx`

- [ ] **Step 1: Write failing component test**

Create `tests/unit/components/outlook-import-dialog.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import { OutlookImportDialog } from '@/components/jobtracker/OutlookImportDialog';

describe('OutlookImportDialog', () => {
  test('shows candidates, preview, and selected import count', async () => {
    const user = userEvent.setup();
    render(
      <OutlookImportDialog
        open
        onOpenChange={() => undefined}
        candidates={[
          {
            payload: {
              messageId: '1',
              subject: 'Thank you for applying to Staff Engineer at Acme',
              fromName: 'Acme Recruiting',
              fromAddress: 'no-reply@greenhouse.io',
              receivedAt: '2026-07-07T12:00:00.000Z',
              bodyPreview: 'We received your application.',
              confidence: 'high',
              score: 90,
              reasons: ['application confirmation phrase'],
              extracted: { companyName: 'Acme', role: 'Staff Engineer', source: 'Outlook', applied: '2026-07-07' },
            },
            signature: 'sig',
          },
        ]}
        connectedEmail="me@example.com"
        loading={false}
        onRescan={vi.fn()}
        onImport={vi.fn()}
      />,
    );

    expect(screen.getByText('Acme')).toBeInTheDocument();
    expect(screen.getByText('Staff Engineer')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Import 1 selected/i })).toBeEnabled();
    await user.click(screen.getByText('Thank you for applying to Staff Engineer at Acme'));
    expect(screen.getByText('application confirmation phrase')).toBeInTheDocument();
  });
});
```

Run:

```bash
pnpm exec vitest run tests/unit/components/outlook-import-dialog.test.tsx
```

Expected: FAIL because the component does not exist.

- [ ] **Step 2: Implement dialog**

Create `OutlookImportDialog.tsx` as a Client Component. Use existing project button/dialog/icon conventions from `JobTrackerApp.tsx`; use an inbox layout:

- Header: `Outlook application scan`
- Small connected account text
- Left pane: candidate rows with checkboxes, company, role, received time, confidence
- Right pane: selected email preview, reasons, extracted card fields
- Footer: `Cancel`, `Rescan`, `Import N selected`
- Preselect high-confidence candidates only
- Medium and low confidence visible but unchecked

State contract:

```ts
type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidates: SignedImportCandidate[];
  connectedEmail: string | null;
  loading: boolean;
  onRescan: () => Promise<void> | void;
  onImport: (candidates: SignedImportCandidate[]) => Promise<void> | void;
};
```

Run:

```bash
pnpm exec vitest run tests/unit/components/outlook-import-dialog.test.tsx
```

Expected: PASS.

- [ ] **Step 3: Wire Home board button**

Modify `src/components/jobtracker/JobTrackerApp.tsx`:

1. Add `OutlookImportDialog` import.
2. In `BoardView`, add state for dialog open, loading, candidates, connected email.
3. Add a `Scan email` button next to `.board__counter`.
4. On click:
   - call `GET /api/outlook/status`
   - if disconnected, set `window.location.href = '/api/outlook/oauth/start'`
   - if connected, call `POST /api/outlook/scan`
   - open dialog with candidates
5. On import:
   - call `POST /api/outlook/import`
   - if one import, navigate to `/card/<displayId>`
   - if multiple, show the existing toast pattern if available; otherwise close dialog and refresh board data

Button markup target:

```tsx
<button className="board__scan-email" type="button" onClick={openOutlookScan}>
  <Icon name="mail-search" size={14} />
  Scan email
</button>
```

Run:

```bash
pnpm run typecheck
pnpm exec vitest run tests/unit/components/outlook-import-dialog.test.tsx
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/jobtracker/OutlookImportDialog.tsx src/components/jobtracker/JobTrackerApp.tsx tests/unit/components/outlook-import-dialog.test.tsx
git commit -m "feat: add outlook import review dialog"
```

---

## Task 11: Playwright Mocked UI Flow

**Files:**
- Create or modify: `tests/e2e/outlook-import.spec.ts`

- [ ] **Step 1: Add mocked e2e**

Create a Playwright spec that:

1. sets local mode to avoid real Microsoft during CI
2. mocks `/api/outlook/status` to return connected
3. mocks `/api/outlook/scan` to return two candidates, one high and one medium
4. clicks `Scan email`
5. confirms high-confidence row is preselected
6. selects medium row
7. mocks `/api/outlook/import` to return two imported cards
8. clicks `Import 2 selected`

Core mock data:

```ts
const candidate = {
  payload: {
    messageId: 'message-1',
    subject: 'Thank you for applying to Staff Engineer at Acme',
    fromName: 'Acme Recruiting',
    fromAddress: 'no-reply@greenhouse.io',
    receivedAt: '2026-07-07T12:00:00.000Z',
    bodyPreview: 'We received your application.',
    confidence: 'high',
    score: 90,
    reasons: ['application confirmation phrase'],
    extracted: { companyName: 'Acme', role: 'Staff Engineer', source: 'Outlook', applied: '2026-07-07' },
  },
  signature: 'test-signature',
};
```

Run:

```bash
NEXT_PUBLIC_PERSISTENCE_ADAPTER=local pnpm run test:e2e -- tests/e2e/outlook-import.spec.ts
```

Expected: PASS.

- [ ] **Step 2: Commit**

```bash
git add tests/e2e/outlook-import.spec.ts
git commit -m "test: cover outlook import review flow"
```

---

## Task 12: Real Azure Local Smoke

**Files:**
- No committed file changes expected

- [ ] **Step 1: Run app in Supabase mode**

Use the real `.env.local` values from Task 1:

```bash
NEXT_PUBLIC_PERSISTENCE_ADAPTER=supabase pnpm run dev
```

Expected: local dev server starts on `http://localhost:3000`.

- [ ] **Step 2: Connect Outlook**

Open:

```text
http://localhost:3000
```

Click:

```text
Scan email
```

Expected if not connected: Microsoft consent flow starts and returns to `/?outlook=connected`.

- [ ] **Step 3: Scan real mailbox**

Click:

```text
Scan email
```

Expected: modal opens. If the mailbox has application confirmations from the last three days, they appear in the left pane; if not, empty state appears without route errors.

- [ ] **Step 4: Import one safe candidate**

Select one known real application confirmation and click `Import 1 selected`.

Expected:

1. One card is created with status `applied`.
2. The card opens in detail view.
3. Card has company, role, applied date, `Outlook` tag/source, and posting link when available.
4. Re-running `Scan email` does not show the same message again.

- [ ] **Step 5: Commit nothing**

This task is a manual smoke. Do not commit `.env.local` or browser artifacts.

---

## Task 13: Full Validation And Existing Suite

**Files:**
- No code changes unless validation reveals a real regression

- [ ] **Step 1: Run focused unit tests**

```bash
pnpm exec vitest run tests/unit/outlook tests/unit/applications/server-card-factory.test.ts tests/unit/repositories/outlook-repository.test.ts tests/unit/api/outlook/routes.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run full static checks**

```bash
pnpm run typecheck
pnpm run lint
pnpm run test:unit
pnpm run build
```

Expected: PASS.

- [ ] **Step 3: Run e2e local mode**

The repo has a known shared `.next` hazard when running local and Supabase e2e projects together. Run local-mode validation alone:

```bash
NEXT_PUBLIC_PERSISTENCE_ADAPTER=local pnpm run test:e2e
```

Expected: PASS, except any pre-existing skipped tests remain skipped.

- [ ] **Step 4: Run Supabase smoke only**

Use the real Azure-connected local smoke from Task 12 instead of running both Playwright projects against one `.next` directory.

Expected: real Outlook scan/import works with Supabase persistence.

- [ ] **Step 5: Commit fixes if needed**

Only if validation exposes a real Outlook regression:

```bash
git add <changed-files>
git commit -m "fix: stabilize outlook import validation"
```

---

## Task 14: Merge, Deploy, And Production Smoke

**Files:**
- No code files expected

- [ ] **Step 1: Confirm git is clean on Development**

```bash
git status --short --branch
```

Expected: branch is `Development`, ahead by the Outlook commits, with no unstaged changes.

- [ ] **Step 2: Merge to dev branch if this work was done elsewhere**

If implementation happened on a feature branch:

```bash
git checkout Development
git merge --no-ff <feature-branch>
git push origin Development
```

Expected: `origin/Development` includes the Outlook import commits.

- [ ] **Step 3: Merge to production branch**

This repo has a `Production` branch. Merge `Development` into `Production`:

```bash
git checkout Production
git pull origin Production
git merge --no-ff Development
git push origin Production
```

Expected: production branch contains the Outlook import commits.

- [ ] **Step 4: Trigger production deployment**

Prefer a true production-target deployment:

```bash
vercel --prod
```

If redeploying an existing production deployment is safer for this repo, use:

```bash
vercel redeploy <deployment-url-or-id> --target production
```

Expected: deployment completes successfully and aliases `https://saisai-gamma.vercel.app`.

- [ ] **Step 5: Production Outlook smoke**

Open:

```text
https://saisai-gamma.vercel.app
```

Click `Scan email`.

Expected:

1. If not connected in production, Microsoft OAuth uses the production redirect URI.
2. Callback returns to `https://saisai-gamma.vercel.app/?outlook=connected`.
3. Scan modal renders.
4. Importing a selected message creates an applied card.

- [ ] **Step 6: Final git status**

```bash
git status --short --branch
```

Expected: production branch is clean and pushed.

---

## Self-Review

- Spec coverage: Azure setup first is Task 1; service-role tables are Task 2; OAuth routes are Tasks 4 and 9; Graph scan is Tasks 6 and 7; deterministic parsing is Task 6; signed review candidates and import verification are Tasks 3, 7, and 8; inbox modal and Home board button are Task 10; mocked e2e and real Azure smoke are Tasks 11 and 12; deploy is Task 14.
- Privacy coverage: raw bodies are used only in scan parsing and are not persisted. Refresh token is AES-GCM encrypted. Browser gets signed extracted candidates only.
- Known harness issue: full mixed Supabase/local Playwright is avoided in Task 13; local suite and real Supabase smoke are validated separately.
- Type consistency: candidate fields are defined once in `candidate-signing.ts` and reused by parser, scan, import, routes, and UI.
