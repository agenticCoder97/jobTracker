# Real Data for Jobs / Companies / Research Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the seed-driven Jobs, Companies, and Research pages with live data from external job APIs (The Muse now, Adzuna key-ready), cached in Supabase, for a single user with no auth.

**Architecture:** The browser never talks to Supabase directly. All reads/writes flow through Next.js route handlers using the service-role admin client, pinned to a single owner (`getOwnerUserId()` → `DEMO_USER_ID`). A provider fan-out pipeline (shared by the manual `/api/research/run` and the `/api/cron/research` routes) fetches jobs, normalises them to `ExternalJob`, upserts into `external_jobs`/`external_companies`, and logs each call to `api_call_log`/`cron_runs`. Read routes map cached rows into the existing UI shapes (`JobListing`, `Company`, `DailyPick`) and attach a server-computed match score. The `local` persistence adapter stays a working fallback (routes return 501 when it's active).

**Tech Stack:** Next.js (App Router, breaking-changed — read `node_modules/next/dist/docs/` before route work), TypeScript with `exactOptionalPropertyTypes`, Supabase (`@supabase/supabase-js` service role), Zustand store, Zod validation, Vitest, Playwright. Design source: `docs/superpowers/specs/2026-07-06-real-data-single-user-design.md`.

---

## Ground rules for every task

- **TDD**: write the failing test first, watch it fail, implement, watch it pass, commit.
- **`exactOptionalPropertyTypes` is on**: optional fields on our own types are declared `field?: T | undefined` and spread conditionally (`...(x ? { field: x } : {})`) — copy the pattern already in `src/lib/api/types.ts` and `apps-repository.ts`. Never assign `undefined` to a non-`| undefined` property.
- **Server-only modules** start with `import 'server-only';`. Never import them from a Client Component.
- **Commands**: `npm run test` (vitest, non-watch is `npx vitest run`), `npm run lint`, `npm run typecheck`, `npm run build`. Confirm exact script names in `package.json:scripts` at Task 0.
- **DB access from Claude**: use the Supabase MCP (`mcp__supabase__apply_migration`, `execute_sql`, `list_tables`) against project `zpfvdswiaiqoptfsafpd`. Mirror every applied migration into `docs/backend/migrations/`.
- **Provider fan-out uses The Muse only in practice** until `ADZUNA_APP_ID`/`ADZUNA_APP_KEY` are set; `adzuna.searchJobs` already returns an empty result + error report when keys are missing, so the pipeline must tolerate empty/errored provider results without failing the run.

---

## Task 0: Baseline — confirm scripts, tests green, types map

**Files:**
- Read: `package.json`, `src/lib/types.ts`, `src/lib/data/seed.ts`

- [ ] **Step 1: Confirm script names**

Run: `npm run typecheck && npm run lint && npx vitest run`
Expected: all pass on the fresh `feature/real-data-jobs-companies-research` branch (baseline green). If a script name differs, note the real name and use it throughout this plan.

- [ ] **Step 2: Note the UI shapes we must produce** (no code; reference while implementing)

From `src/lib/types.ts`:
- `JobListing = { id, displayId, company: CompanyId, role, location, remote: RemoteMode, salaryMin, salaryMax, posted: IsoDate, match, tags: string[], saved: boolean }`
- `Company = { id: CompanyId, name, bg, initial, domain?, logoUrl?, ring?, dark? }`
- `DailyPick = { id, company: CompanyId, role, location, salary, match, why: string[], posted, applicants }`
- `RemoteMode = 'Remote' | 'Hybrid' | 'Onsite'` (note the capitalisation — provider `remote` is lowercase, must be mapped).
- `DEMO_USER_ID = '00000000-0000-0000-0000-000000000001'`.

- [ ] **Step 3: Commit nothing** — this task is read-only.

---

## Task 1: Trimmed migration `0003_research_single_user`

Creates only the tables the single-user design needs, with plain-text provider columns (no `api_providers` FK — that RBAC table is out of scope; provider ids are validated app-side by the `ProviderId` union). `api_call_log` and `cron_runs` match the columns the existing repos already write (`src/lib/repositories/supabase/api-call-log-repository.ts`, `src/app/api/cron/research/route.ts`).

**Files:**
- Create: `docs/backend/migrations/0003_research_single_user.sql`
- Apply: Supabase project `zpfvdswiaiqoptfsafpd` via `mcp__supabase__apply_migration`

- [ ] **Step 1: Write the migration SQL**

```sql
-- JobTracker — Migration 0003: research tables (single-user, trimmed)
-- Scope: external_jobs, external_companies, watched_companies, dismissed_picks,
--        api_call_log, cron_runs. No RBAC / api_providers / quota (deferred).
-- provider columns are plain text; the ProviderId union validates them app-side.
-- Single-user, no auth: the client never connects, so these tables are
-- service-role-only. RLS is enabled with NO anon/authenticated policies, which
-- denies all client access by default while the service role bypasses RLS.

create extension if not exists pgcrypto;

create table if not exists public.external_jobs (
  id uuid primary key default gen_random_uuid(),
  source_provider text not null,
  source_id text not null,
  payload jsonb not null,
  fetched_at timestamptz not null default now(),
  expires_at timestamptz,
  unique (source_provider, source_id)
);
create index if not exists idx_external_jobs_fetched_at
  on public.external_jobs (fetched_at desc);

create table if not exists public.external_companies (
  id uuid primary key default gen_random_uuid(),
  source_provider text not null,
  source_id text not null,
  payload jsonb not null,
  fetched_at timestamptz not null default now(),
  expires_at timestamptz,
  unique (source_provider, source_id)
);

create table if not exists public.watched_companies (
  owner_user_id uuid not null references public.users (id) on delete cascade,
  company_key text not null,
  added_at timestamptz not null default now(),
  primary key (owner_user_id, company_key)
);

-- external_job_id is the synthetic "provider:sourceId" key the client holds
-- (text, not a uuid FK) so the dismiss action works without a server round-trip
-- to resolve the real row id. See Task 8 "Dismiss id note".
create table if not exists public.dismissed_picks (
  owner_user_id uuid not null references public.users (id) on delete cascade,
  external_job_id text not null,
  dismissed_at timestamptz not null default now(),
  primary key (owner_user_id, external_job_id)
);

create table if not exists public.api_call_log (
  id uuid primary key default gen_random_uuid(),
  provider_id text not null,
  request_path text not null,
  http_status integer,
  latency_ms integer,
  ratelimit_remaining integer,
  owner_user_id uuid references public.users (id) on delete set null,
  error text,
  created_at timestamptz not null default now()
);
create index if not exists idx_api_call_log_provider_created
  on public.api_call_log (provider_id, created_at desc);

create table if not exists public.cron_runs (
  id uuid primary key default gen_random_uuid(),
  job_id text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running' check (status in ('running', 'ok', 'error')),
  items_processed integer not null default 0,
  error text
);
create index if not exists idx_cron_runs_job_started
  on public.cron_runs (job_id, started_at desc);

-- RLS: enable everywhere, add owner-scoped policies only for the two
-- user-owned tables (harmless today since the client never connects, but
-- correct-by-construction for when auth lands). The external_*, api_call_log,
-- and cron_runs tables get NO policies → service-role-only.
alter table public.external_jobs      enable row level security;
alter table public.external_companies enable row level security;
alter table public.watched_companies  enable row level security;
alter table public.dismissed_picks    enable row level security;
alter table public.api_call_log       enable row level security;
alter table public.cron_runs          enable row level security;

create policy "own watched_companies" on public.watched_companies
  for all using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());
create policy "own dismissed_picks" on public.dismissed_picks
  for all using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());
```

- [ ] **Step 2: Apply the migration**

Use `mcp__supabase__apply_migration` with `project_id: zpfvdswiaiqoptfsafpd`, `name: "0003_research_single_user"`, and the SQL above.

- [ ] **Step 3: Verify tables exist**

Use `mcp__supabase__list_tables` (schema `public`). Expected: the six new tables appear with `rls_enabled: true`, alongside the existing board tables.

- [ ] **Step 4: Commit the mirrored SQL**

```bash
git add docs/backend/migrations/0003_research_single_user.sql
git commit -m "feat: migration 0003 — research tables (single-user, trimmed)"
```

---

## Task 2: Match-score function (pure, unit-tested)

Deterministic keyword-overlap score in 0–100 between the union of (preference keywords + profile resume keywords) and the job's title/tags/description. Pure and dependency-free so it's trivially testable and reusable server-side.

**Files:**
- Create: `src/lib/research/match-score.ts`
- Test: `tests/unit/research/match-score.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, test } from 'vitest';
import { computeMatchScore } from '@/lib/research/match-score';
import type { ExternalJob } from '@/lib/api/types';

function job(partial: Partial<ExternalJob>): ExternalJob {
  return {
    sourceProvider: 'themuse',
    sourceId: '1',
    title: 'Software Engineer',
    companyName: 'Acme',
    raw: null,
    ...partial,
  };
}

describe('computeMatchScore', () => {
  test('no keywords → neutral 50', () => {
    expect(computeMatchScore(job({}), [])).toBe(50);
  });

  test('full overlap of title + tags → 100', () => {
    const score = computeMatchScore(
      job({ title: 'Senior React Engineer', tags: ['react', 'typescript'] }),
      ['react', 'typescript', 'engineer'],
    );
    expect(score).toBe(100);
  });

  test('partial overlap scales between 0 and 100', () => {
    const score = computeMatchScore(
      job({ title: 'Data Scientist', description: 'python and sql', tags: [] }),
      ['python', 'react', 'go', 'rust'],
    );
    // 1 of 4 keywords present → 25
    expect(score).toBe(25);
  });

  test('is case-insensitive and ignores duplicate keywords', () => {
    const score = computeMatchScore(
      job({ title: 'GraphQL API Engineer', tags: ['GraphQL'] }),
      ['graphql', 'GRAPHQL', 'graphql'],
    );
    expect(score).toBe(100);
  });

  test('score is clamped to the 0..100 integer range', () => {
    const score = computeMatchScore(job({ title: 'Engineer' }), ['engineer']);
    expect(Number.isInteger(score)).toBe(true);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });
});
```

- [ ] **Step 2: Run the test — expect FAIL**

Run: `npx vitest run tests/unit/research/match-score.test.ts`
Expected: FAIL — `computeMatchScore` is not defined.

- [ ] **Step 3: Implement**

```ts
import type { ExternalJob } from '@/lib/api/types';

/**
 * Deterministic 0–100 keyword-overlap score. When there are no keywords we
 * return a neutral 50 so an unconfigured user still sees a sensible ranking.
 * Otherwise: (distinct keywords found in the job's searchable text) /
 * (distinct keywords) × 100, rounded to an integer.
 */
export function computeMatchScore(job: ExternalJob, keywords: string[]): number {
  const distinct = Array.from(
    new Set(keywords.map((k) => k.trim().toLowerCase()).filter((k) => k.length > 0)),
  );
  if (distinct.length === 0) return 50;

  const haystack = [job.title, job.description ?? '', ...(job.tags ?? [])]
    .join(' ')
    .toLowerCase();

  const hits = distinct.filter((k) => haystack.includes(k)).length;
  const score = Math.round((hits / distinct.length) * 100);
  return Math.max(0, Math.min(100, score));
}
```

- [ ] **Step 4: Run the test — expect PASS**

Run: `npx vitest run tests/unit/research/match-score.test.ts`
Expected: PASS (all five cases).

- [ ] **Step 5: Commit**

```bash
git add src/lib/research/match-score.ts tests/unit/research/match-score.test.ts
git commit -m "feat: deterministic keyword match-score for research jobs"
```

---

## Task 3: Search preferences module + profiles repo

Preferences live in the owner's `profiles.payload` (design §6). A tiny server-only repo reads/writes them, defaulting sensibly when the row is missing. Preference keywords + profile resume keywords feed the pipeline's match score.

**Files:**
- Create: `src/lib/research/preferences.ts` (types + defaults + keyword extraction — universal-safe, no `server-only`)
- Create: `src/lib/repositories/supabase/research-preferences-repository.ts` (server-only)
- Test: `tests/unit/research/preferences.test.ts`

- [ ] **Step 1: Write the failing test (pure helpers only)**

```ts
import { describe, expect, test } from 'vitest';
import {
  DEFAULT_SEARCH_PREFERENCES,
  normalizeSearchPreferences,
  preferenceKeywords,
} from '@/lib/research/preferences';

describe('search preferences', () => {
  test('normalize fills defaults for a partial/empty object', () => {
    expect(normalizeSearchPreferences({})).toEqual(DEFAULT_SEARCH_PREFERENCES);
  });

  test('normalize trims + dedupes + drops empty keywords', () => {
    const prefs = normalizeSearchPreferences({
      keywords: [' React ', 'react', '', 'TypeScript'],
      location: ' Remote ',
      remote: 'remote',
    });
    expect(prefs.keywords).toEqual(['react', 'typescript']);
    expect(prefs.location).toBe('Remote');
    expect(prefs.remote).toBe('remote');
  });

  test('normalize rejects an unknown remote value → any', () => {
    expect(normalizeSearchPreferences({ remote: 'martian' as never }).remote).toBe('any');
  });

  test('preferenceKeywords merges prefs + resume keywords, deduped', () => {
    const merged = preferenceKeywords(
      { keywords: ['react', 'node'], location: '', remote: 'any' },
      ['Node', 'GraphQL'],
    );
    expect(merged.sort()).toEqual(['graphql', 'node', 'react']);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npx vitest run tests/unit/research/preferences.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `preferences.ts`**

```ts
export type SearchRemote = 'remote' | 'hybrid' | 'onsite' | 'any';

export type SearchPreferences = {
  keywords: string[];
  location: string;
  remote: SearchRemote;
};

export const DEFAULT_SEARCH_PREFERENCES: SearchPreferences = {
  keywords: [],
  location: '',
  remote: 'any',
};

const REMOTE_VALUES: SearchRemote[] = ['remote', 'hybrid', 'onsite', 'any'];

function dedupeLower(values: readonly string[]): string[] {
  return Array.from(
    new Set(values.map((v) => v.trim().toLowerCase()).filter((v) => v.length > 0)),
  );
}

export function normalizeSearchPreferences(input: Partial<SearchPreferences>): SearchPreferences {
  const remote = REMOTE_VALUES.includes(input.remote as SearchRemote)
    ? (input.remote as SearchRemote)
    : 'any';
  return {
    keywords: dedupeLower(input.keywords ?? []),
    location: (input.location ?? '').trim(),
    remote,
  };
}

/** Union of preference keywords + resume-derived keywords, lowercased & deduped. */
export function preferenceKeywords(prefs: SearchPreferences, resumeKeywords: string[]): string[] {
  return dedupeLower([...prefs.keywords, ...resumeKeywords]);
}
```

- [ ] **Step 4: Run — expect PASS**

Run: `npx vitest run tests/unit/research/preferences.test.ts`
Expected: PASS.

- [ ] **Step 5: Implement the profiles preferences repo (no separate test — covered via route tests in Task 6/9)**

```ts
// src/lib/repositories/supabase/research-preferences-repository.ts
import 'server-only';

import {
  DEFAULT_SEARCH_PREFERENCES,
  normalizeSearchPreferences,
  type SearchPreferences,
} from '@/lib/research/preferences';
import { getOwnerUserId } from '@/lib/server/owner';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';

const PREFS_KEY = 'searchPreferences';

/** Reads searchPreferences out of the owner's profiles.payload, defaulting. */
export async function getSearchPreferences(): Promise<SearchPreferences> {
  const admin = getSupabaseAdminClient();
  const owner = getOwnerUserId();
  const { data, error } = await admin
    .from('profiles')
    .select('payload')
    .eq('owner_user_id', owner)
    .maybeSingle();
  if (error) throw new Error(`profiles read failed: ${error.message}`);
  const payload = (data?.payload ?? {}) as Record<string, unknown>;
  const raw = (payload[PREFS_KEY] ?? {}) as Partial<SearchPreferences>;
  return normalizeSearchPreferences(raw);
}

/** Merges searchPreferences into the owner's profiles.payload (upsert). */
export async function setSearchPreferences(
  input: Partial<SearchPreferences>,
): Promise<SearchPreferences> {
  const admin = getSupabaseAdminClient();
  const owner = getOwnerUserId();
  const next = normalizeSearchPreferences(input);

  const { data, error: readError } = await admin
    .from('profiles')
    .select('payload')
    .eq('owner_user_id', owner)
    .maybeSingle();
  if (readError) throw new Error(`profiles read failed: ${readError.message}`);

  const payload = { ...((data?.payload ?? {}) as Record<string, unknown>), [PREFS_KEY]: next };
  const { error: writeError } = await admin
    .from('profiles')
    .upsert(
      { owner_user_id: owner, payload, updated_at: new Date().toISOString() },
      { onConflict: 'owner_user_id' },
    );
  if (writeError) throw new Error(`profiles write failed: ${writeError.message}`);
  return next;
}

export { DEFAULT_SEARCH_PREFERENCES };
```

> **Verify at implementation time:** confirm `profiles` has an `owner_user_id` column and a unique/PK constraint usable for `onConflict: 'owner_user_id'` (check `docs/backend/supabase-bootstrap.sql`). If the PK is a different column, adjust `onConflict` and the `.eq()` filter to match.

- [ ] **Step 6: Commit**

```bash
git add src/lib/research/preferences.ts \
        src/lib/repositories/supabase/research-preferences-repository.ts \
        tests/unit/research/preferences.test.ts
git commit -m "feat: search preferences model + profiles-backed repository"
```

---

## Task 4: Research repository — external jobs/companies, watched, dismissed

Server-only persistence for the research tables. Follows the `apps-repository.ts` pattern: functions using `getSupabaseAdminClient()` + `getOwnerUserId()`, JSONB-first payloads.

**Files:**
- Create: `src/lib/repositories/supabase/research-repository.ts`
- Test: `tests/unit/repositories/research-repository.test.ts` (mock the admin client)

- [ ] **Step 1: Write the failing test (upsert payload shaping + owner pinning via a mocked admin client)**

```ts
import { beforeEach, describe, expect, test, vi } from 'vitest';

const upsert = vi.fn().mockResolvedValue({ error: null });
const from = vi.fn(() => ({ upsert }));
vi.mock('@/lib/supabase/admin', () => ({
  getSupabaseAdminClient: () => ({ from }),
}));
vi.mock('@/lib/server/owner', () => ({ getOwnerUserId: () => 'owner-1' }));

import { upsertExternalJobs } from '@/lib/repositories/supabase/research-repository';
import type { ExternalJob } from '@/lib/api/types';

const job: ExternalJob = {
  sourceProvider: 'themuse',
  sourceId: '42',
  title: 'Engineer',
  companyName: 'Acme',
  raw: { any: 'thing' },
};

describe('upsertExternalJobs', () => {
  beforeEach(() => {
    upsert.mockClear();
    from.mockClear();
  });

  test('writes payload row keyed on (source_provider, source_id)', async () => {
    await upsertExternalJobs([job]);
    expect(from).toHaveBeenCalledWith('external_jobs');
    const [rows, opts] = upsert.mock.calls[0]!;
    expect(opts).toEqual({ onConflict: 'source_provider,source_id' });
    expect(rows[0]).toMatchObject({
      source_provider: 'themuse',
      source_id: '42',
      payload: job,
    });
    expect(typeof rows[0].fetched_at).toBe('string');
  });

  test('no-op on an empty array', async () => {
    await upsertExternalJobs([]);
    expect(upsert).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npx vitest run tests/unit/repositories/research-repository.test.ts`
Expected: FAIL — module/function not found.

- [ ] **Step 3: Implement the repository**

```ts
import 'server-only';

import type { ExternalCompany, ExternalJob } from '@/lib/api/types';
import { getOwnerUserId } from '@/lib/server/owner';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';

type StoredJobRow = { payload: ExternalJob; fetched_at: string };
type StoredCompanyRow = { payload: ExternalCompany; fetched_at: string };

export async function upsertExternalJobs(jobs: ExternalJob[]): Promise<void> {
  if (jobs.length === 0) return;
  const admin = getSupabaseAdminClient();
  const now = new Date().toISOString();
  const rows = jobs.map((job) => ({
    source_provider: job.sourceProvider,
    source_id: job.sourceId,
    payload: job,
    fetched_at: now,
  }));
  const { error } = await admin
    .from('external_jobs')
    .upsert(rows, { onConflict: 'source_provider,source_id' });
  if (error) throw new Error(`external_jobs upsert failed: ${error.message}`);
}

export async function upsertExternalCompanies(companies: ExternalCompany[]): Promise<void> {
  if (companies.length === 0) return;
  const admin = getSupabaseAdminClient();
  const now = new Date().toISOString();
  const rows = companies.map((company) => ({
    source_provider: company.sourceProvider,
    source_id: company.sourceId,
    payload: company,
    fetched_at: now,
  }));
  const { error } = await admin
    .from('external_companies')
    .upsert(rows, { onConflict: 'source_provider,source_id' });
  if (error) throw new Error(`external_companies upsert failed: ${error.message}`);
}

export async function listExternalJobs(limit = 200): Promise<ExternalJob[]> {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from('external_jobs')
    .select('payload, fetched_at')
    .order('fetched_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(`external_jobs list failed: ${error.message}`);
  return ((data ?? []) as StoredJobRow[]).map((row) => row.payload);
}

export async function listExternalCompanies(limit = 500): Promise<ExternalCompany[]> {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from('external_companies')
    .select('payload, fetched_at')
    .order('fetched_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(`external_companies list failed: ${error.message}`);
  return ((data ?? []) as StoredCompanyRow[]).map((row) => row.payload);
}

export async function listWatchedCompanyKeys(): Promise<string[]> {
  const admin = getSupabaseAdminClient();
  const owner = getOwnerUserId();
  const { data, error } = await admin
    .from('watched_companies')
    .select('company_key')
    .eq('owner_user_id', owner);
  if (error) throw new Error(`watched_companies list failed: ${error.message}`);
  return ((data ?? []) as { company_key: string }[]).map((r) => r.company_key);
}

export async function addWatchedCompany(companyKey: string): Promise<void> {
  const admin = getSupabaseAdminClient();
  const owner = getOwnerUserId();
  const { error } = await admin
    .from('watched_companies')
    .upsert(
      { owner_user_id: owner, company_key: companyKey, added_at: new Date().toISOString() },
      { onConflict: 'owner_user_id,company_key' },
    );
  if (error) throw new Error(`watched_companies add failed: ${error.message}`);
}

export async function removeWatchedCompany(companyKey: string): Promise<void> {
  const admin = getSupabaseAdminClient();
  const owner = getOwnerUserId();
  const { error } = await admin
    .from('watched_companies')
    .delete()
    .eq('owner_user_id', owner)
    .eq('company_key', companyKey);
  if (error) throw new Error(`watched_companies remove failed: ${error.message}`);
}

export async function listDismissedPickIds(): Promise<string[]> {
  const admin = getSupabaseAdminClient();
  const owner = getOwnerUserId();
  const { data, error } = await admin
    .from('dismissed_picks')
    .select('external_job_id')
    .eq('owner_user_id', owner);
  if (error) throw new Error(`dismissed_picks list failed: ${error.message}`);
  return ((data ?? []) as { external_job_id: string }[]).map((r) => r.external_job_id);
}

export async function dismissPick(externalJobId: string): Promise<void> {
  const admin = getSupabaseAdminClient();
  const owner = getOwnerUserId();
  const { error } = await admin
    .from('dismissed_picks')
    .upsert(
      {
        owner_user_id: owner,
        external_job_id: externalJobId,
        dismissed_at: new Date().toISOString(),
      },
      { onConflict: 'owner_user_id,external_job_id' },
    );
  if (error) throw new Error(`dismissed_picks add failed: ${error.message}`);
}
```

- [ ] **Step 4: Run — expect PASS**

Run: `npx vitest run tests/unit/repositories/research-repository.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/repositories/supabase/research-repository.ts \
        tests/unit/repositories/research-repository.test.ts
git commit -m "feat: research repository — external jobs/companies, watched, dismissed"
```

---

## Task 5: Company derivation helper

Derive `ExternalCompany` rows from a batch of `ExternalJob`s (design §6: "derives/upserts external_companies (company name/domain from listings; logo via Clearbit)"). One company per distinct `companyName`, domain guessed from the listing where available, logo via Clearbit URL when a domain is known.

**Files:**
- Create: `src/lib/research/derive-companies.ts`
- Test: `tests/unit/research/derive-companies.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, test } from 'vitest';
import { deriveCompaniesFromJobs } from '@/lib/research/derive-companies';
import type { ExternalJob } from '@/lib/api/types';

function job(p: Partial<ExternalJob>): ExternalJob {
  return { sourceProvider: 'themuse', sourceId: '1', title: 'Eng', companyName: 'Acme', raw: null, ...p };
}

describe('deriveCompaniesFromJobs', () => {
  test('collapses jobs to one company per distinct name', () => {
    const companies = deriveCompaniesFromJobs([
      job({ sourceId: '1', companyName: 'Acme' }),
      job({ sourceId: '2', companyName: 'Acme' }),
      job({ sourceId: '3', companyName: 'Globex' }),
    ]);
    expect(companies).toHaveLength(2);
    expect(companies.map((c) => c.name).sort()).toEqual(['Acme', 'Globex']);
  });

  test('uses a stable source_id (slug) and carries domain + clearbit logo', () => {
    const [company] = deriveCompaniesFromJobs([
      job({ companyName: 'Acme Corp', companyDomain: 'acme.com' }),
    ]);
    expect(company!.sourceId).toBe('acme-corp');
    expect(company!.domain).toBe('acme.com');
    expect(company!.logoUrl).toBe('https://logo.clearbit.com/acme.com');
  });

  test('no domain → no logo, slug still stable', () => {
    const [company] = deriveCompaniesFromJobs([job({ companyName: 'No Domain Inc' })]);
    expect(company!.sourceId).toBe('no-domain-inc');
    expect(company!.domain).toBeUndefined();
    expect(company!.logoUrl).toBeUndefined();
  });

  test('skips jobs with an unknown/blank company name', () => {
    expect(deriveCompaniesFromJobs([job({ companyName: 'Unknown' }), job({ companyName: '' })])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npx vitest run tests/unit/research/derive-companies.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
import type { ExternalCompany, ExternalJob } from '@/lib/api/types';

export function companySlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** One ExternalCompany per distinct, known company name found in a job batch. */
export function deriveCompaniesFromJobs(jobs: ExternalJob[]): ExternalCompany[] {
  const byName = new Map<string, ExternalCompany>();
  for (const job of jobs) {
    const name = job.companyName?.trim();
    if (!name || name.toLowerCase() === 'unknown') continue;
    if (byName.has(name)) continue;
    const domain = job.companyDomain?.trim() || undefined;
    byName.set(name, {
      sourceProvider: job.sourceProvider,
      sourceId: companySlug(name),
      name,
      ...(domain ? { domain } : {}),
      ...(domain ? { logoUrl: `https://logo.clearbit.com/${domain}` } : {}),
      raw: { derivedFrom: job.sourceProvider },
    });
  }
  return Array.from(byName.values());
}
```

- [ ] **Step 4: Run — expect PASS**

Run: `npx vitest run tests/unit/research/derive-companies.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/research/derive-companies.ts tests/unit/research/derive-companies.test.ts
git commit -m "feat: derive external companies from job listings"
```

---

## Task 6: Research pipeline engine (shared by run + cron)

The single orchestration function both `/api/research/run` and `/api/cron/research` call. Loads preferences → builds a `JobSearchQuery` → fans out over `listJobProviders()` → collects jobs + call reports → upserts jobs & derived companies → writes each report to `api_call_log`. Tolerates empty/errored providers (Adzuna with no keys). Returns a summary. Opening/closing the `cron_runs` row stays in the cron route (already implemented there); the run route reuses the engine without the cron row.

**Files:**
- Create: `src/lib/research/pipeline.ts` (server-only)
- Test: `tests/unit/research/pipeline.test.ts` (mock providers, repos, api-call-log, preferences)

- [ ] **Step 1: Write the failing test**

```ts
import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { ExternalJob, JobProvider } from '@/lib/api/types';

const okProvider: JobProvider = {
  id: 'themuse',
  kind: 'jobs',
  async searchJobs() {
    const jobs: ExternalJob[] = [
      { sourceProvider: 'themuse', sourceId: 'a', title: 'React Engineer', companyName: 'Acme', tags: ['react'], raw: null },
    ];
    return { jobs, report: { providerId: 'themuse', requestPath: '/jobs', httpStatus: 200, latencyMs: 5 } };
  },
};
const emptyProvider: JobProvider = {
  id: 'adzuna',
  kind: 'jobs',
  async searchJobs() {
    return { jobs: [], report: { providerId: 'adzuna', requestPath: '/search', httpStatus: 0, latencyMs: 0, error: 'missing keys' } };
  },
};

vi.mock('@/lib/api/registry', () => ({ listJobProviders: () => [okProvider, emptyProvider] }));
const upsertExternalJobs = vi.fn().mockResolvedValue(undefined);
const upsertExternalCompanies = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/repositories/supabase/research-repository', () => ({
  upsertExternalJobs: (...a: unknown[]) => upsertExternalJobs(...a),
  upsertExternalCompanies: (...a: unknown[]) => upsertExternalCompanies(...a),
}));
const append = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/repositories/server', () => ({ getApiCallLogRepository: () => ({ append }) }));
vi.mock('@/lib/repositories/supabase/research-preferences-repository', () => ({
  getSearchPreferences: async () => ({ keywords: ['react'], location: '', remote: 'any' }),
}));
vi.mock('@/lib/repositories/supabase/resume-keywords', () => ({ getResumeKeywords: async () => [] }), { virtual: true });

import { runResearchRefresh } from '@/lib/research/pipeline';

describe('runResearchRefresh', () => {
  beforeEach(() => {
    upsertExternalJobs.mockClear();
    upsertExternalCompanies.mockClear();
    append.mockClear();
  });

  test('fans out, upserts jobs + companies, logs every provider call', async () => {
    const summary = await runResearchRefresh();
    expect(summary.providersCalled).toBe(2);
    expect(summary.jobsUpserted).toBe(1);
    expect(summary.errors).toEqual([{ providerId: 'adzuna', error: 'missing keys' }]);
    expect(upsertExternalJobs).toHaveBeenCalledTimes(1);
    expect(upsertExternalCompanies).toHaveBeenCalledTimes(1);
    expect(append).toHaveBeenCalledTimes(2); // one per provider report
  });
});
```

> The `resume-keywords` mock is `virtual` so the test passes whether or not you add a real resume-keyword extractor. In the implementation, keep resume keywords optional: if you have no resume-keyword source yet, pass `[]`.

- [ ] **Step 2: Run — expect FAIL**

Run: `npx vitest run tests/unit/research/pipeline.test.ts`
Expected: FAIL — `runResearchRefresh` not defined.

- [ ] **Step 3: Implement the engine**

```ts
import 'server-only';

import type { JobSearchQuery, ProviderCallReport } from '@/lib/api/types';
import { listJobProviders } from '@/lib/api/registry';
import { deriveCompaniesFromJobs } from '@/lib/research/derive-companies';
import { getSearchPreferences } from '@/lib/repositories/supabase/research-preferences-repository';
import {
  upsertExternalCompanies,
  upsertExternalJobs,
} from '@/lib/repositories/supabase/research-repository';
import { getApiCallLogRepository } from '@/lib/repositories/server';

export type ResearchRunSummary = {
  providersCalled: number;
  jobsUpserted: number;
  companiesUpserted: number;
  errors: Array<{ providerId: string; error: string }>;
};

function toQuery(keywords: string[], location: string, remote: string): JobSearchQuery {
  return {
    ...(keywords.length ? { keywords } : {}),
    ...(location ? { location } : {}),
    ...(remote === 'remote' || remote === 'hybrid' || remote === 'onsite' ? { remote } : {}),
    pageSize: 20,
  };
}

export async function runResearchRefresh(): Promise<ResearchRunSummary> {
  const prefs = await getSearchPreferences();
  const query = toQuery(prefs.keywords, prefs.location, prefs.remote);

  const providers = listJobProviders();
  const reports: ProviderCallReport[] = [];
  const errors: Array<{ providerId: string; error: string }> = [];
  const allJobs = [];

  for (const provider of providers) {
    try {
      const { jobs, report } = await provider.searchJobs(query);
      reports.push(report);
      if (report.error) errors.push({ providerId: provider.id, error: report.error });
      allJobs.push(...jobs);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push({ providerId: provider.id, error: message });
      reports.push({
        providerId: provider.id,
        requestPath: '/error',
        httpStatus: 0,
        latencyMs: 0,
        error: message,
      });
    }
  }

  await upsertExternalJobs(allJobs);
  const companies = deriveCompaniesFromJobs(allJobs);
  await upsertExternalCompanies(companies);

  const apiCallLog = getApiCallLogRepository();
  for (const report of reports) {
    await apiCallLog.append({
      providerId: report.providerId,
      requestPath: report.requestPath,
      httpStatus: report.httpStatus,
      latencyMs: report.latencyMs,
      ...(report.rateLimitRemaining !== undefined
        ? { rateLimitRemaining: report.rateLimitRemaining }
        : {}),
      ...(report.ownerUserId ? { ownerUserId: report.ownerUserId } : {}),
      ...(report.error ? { error: report.error } : {}),
    });
  }

  return {
    providersCalled: providers.length,
    jobsUpserted: allJobs.length,
    companiesUpserted: companies.length,
    errors,
  };
}
```

- [ ] **Step 4: Run — expect PASS**

Run: `npx vitest run tests/unit/research/pipeline.test.ts`
Expected: PASS.

- [ ] **Step 5: Wire the run route to the engine (relax auth for single-user)**

Replace `src/app/api/research/run/route.ts` body. In single-user/no-auth mode `assertRole('admin')` always fails (no session), so gate by the adapter flag + accept the CRON_SECRET bearer as an operator override (design §6 wants a browser-triggerable Refresh button; the button calls this route same-origin).

```ts
import { NextResponse } from 'next/server';

import { runResearchRefresh } from '@/lib/research/pipeline';
import { shouldUseSupabaseAdapter } from '@/lib/supabase/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  if (!shouldUseSupabaseAdapter()) {
    return NextResponse.json(
      { error: 'supabase adapter disabled - set NEXT_PUBLIC_PERSISTENCE_ADAPTER=supabase' },
      { status: 501 },
    );
  }
  try {
    const summary = await runResearchRefresh();
    return NextResponse.json({ ok: true, ...summary });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 503 },
    );
  }
}
```

- [ ] **Step 6: Wire the cron route to the engine**

In `src/app/api/cron/research/route.ts`, keep `assertCronAuth` + the `cron_runs` open/close logic, but replace the `// TODO(phase 2)` block: call `runResearchRefresh()`, set `itemsProcessed = summary.jobsUpserted`, set `cron_runs.status` to `'error'` if `summary.errors.length && summary.jobsUpserted === 0`, and include the summary in the JSON response. Wrap the call in try/catch so a thrown pipeline error still closes the `cron_runs` row with `status: 'error'` and the error message.

- [ ] **Step 7: Verify build + tests**

Run: `npm run typecheck && npx vitest run`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/lib/research/pipeline.ts tests/unit/research/pipeline.test.ts \
        src/app/api/research/run/route.ts src/app/api/cron/research/route.ts
git commit -m "feat: research pipeline engine wired to run + cron routes"
```

---

## Task 7: Job-listing mapper + `GET /api/jobs/listings`

Maps cached `ExternalJob` rows to the UI `JobListing` shape with a match score, and serves them. `company` in `JobListing` is a `CompanyId` string — use the company slug so Jobs/Companies/Research agree on the key.

**Files:**
- Create: `src/lib/research/to-job-listing.ts`
- Create: `src/app/api/jobs/listings/route.ts`
- Test: `tests/unit/research/to-job-listing.test.ts`, `tests/unit/api/jobs-listings-route.test.ts`

- [ ] **Step 1: Write the failing mapper test**

```ts
import { describe, expect, test } from 'vitest';
import { toJobListing } from '@/lib/research/to-job-listing';
import type { ExternalJob } from '@/lib/api/types';

const base: ExternalJob = {
  sourceProvider: 'themuse',
  sourceId: '7',
  title: 'Senior React Engineer',
  companyName: 'Acme Corp',
  location: 'Remote',
  remote: 'remote',
  salaryMin: 120000,
  salaryMax: 160000,
  postedAt: '2026-07-01T00:00:00.000Z',
  applyUrl: 'https://acme.com/apply',
  tags: ['react'],
  raw: null,
};

describe('toJobListing', () => {
  test('maps external job to the UI shape with match + capitalised remote', () => {
    const listing = toJobListing(base, ['react']);
    expect(listing).toMatchObject({
      company: 'acme-corp',
      role: 'Senior React Engineer',
      location: 'Remote',
      remote: 'Remote',
      salaryMin: 120000,
      salaryMax: 160000,
      match: 100,
      tags: ['react'],
      saved: false,
    });
    expect(listing.id).toBe('themuse:7');
    expect(listing.displayId).toMatch(/^JOB-/);
  });

  test('defaults missing remote/salary/location safely', () => {
    const listing = toJobListing(
      { sourceProvider: 'themuse', sourceId: '9', title: 'Dev', companyName: 'X', raw: null },
      [],
    );
    expect(listing.remote).toBe('Onsite');
    expect(listing.salaryMin).toBe(0);
    expect(listing.location).toBe('—');
  });
});
```

- [ ] **Step 2: Run — expect FAIL**, then **implement `to-job-listing.ts`**

```ts
import type { ExternalJob, JobListing, RemoteMode } from '@/lib/types';
import type { ExternalJob as ProviderJob } from '@/lib/api/types';
import { companySlug } from '@/lib/research/derive-companies';
import { computeMatchScore } from '@/lib/research/match-score';

function toRemoteMode(remote: ProviderJob['remote']): RemoteMode {
  switch (remote) {
    case 'remote':
      return 'Remote';
    case 'hybrid':
      return 'Hybrid';
    default:
      return 'Onsite';
  }
}

/** Stable synthetic id so the client can key rows and post actions back. */
export function externalJobKey(job: ProviderJob): string {
  return `${job.sourceProvider}:${job.sourceId}`;
}

export function toJobListing(job: ProviderJob, keywords: string[]): JobListing {
  return {
    id: externalJobKey(job) as JobListing['id'],
    displayId: `JOB-${job.sourceId}`,
    company: companySlug(job.companyName) as JobListing['company'],
    role: job.title,
    location: job.location?.trim() || '—',
    remote: toRemoteMode(job.remote),
    salaryMin: job.salaryMin ?? 0,
    salaryMax: job.salaryMax ?? 0,
    posted: (job.postedAt ?? new Date().toISOString()).slice(0, 10),
    match: computeMatchScore(job, keywords),
    tags: job.tags ?? [],
    saved: false,
  };
}
```

> **Note:** `JobListing` is imported from `@/lib/types`; the provider job is imported from `@/lib/api/types` (aliased `ProviderJob`) to avoid the name clash. The `@/lib/types` `ExternalJob` import in the example is illustrative — remove it if `@/lib/types` doesn't export that name; only `JobListing` and `RemoteMode` are needed from there.

- [ ] **Step 3: Write the failing route test** (mock the repo + prefs so no DB is needed)

```ts
import { describe, expect, test, vi } from 'vitest';

vi.mock('@/lib/supabase/env', () => ({ shouldUseSupabaseAdapter: () => true }));
vi.mock('@/lib/repositories/supabase/research-repository', () => ({
  listExternalJobs: async () => [
    { sourceProvider: 'themuse', sourceId: '1', title: 'React Dev', companyName: 'Acme', tags: ['react'], raw: null },
  ],
}));
vi.mock('@/lib/repositories/supabase/research-preferences-repository', () => ({
  getSearchPreferences: async () => ({ keywords: ['react'], location: '', remote: 'any' }),
}));

import { GET } from '@/app/api/jobs/listings/route';

describe('GET /api/jobs/listings', () => {
  test('returns mapped listings with match scores', async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.listings).toHaveLength(1);
    expect(body.listings[0]).toMatchObject({ company: 'acme', role: 'React Dev', match: 100 });
  });
});
```

- [ ] **Step 4: Implement the route**

```ts
import { NextResponse } from 'next/server';

import { getSearchPreferences } from '@/lib/repositories/supabase/research-preferences-repository';
import { listExternalJobs } from '@/lib/repositories/supabase/research-repository';
import { preferenceKeywords } from '@/lib/research/preferences';
import { toJobListing } from '@/lib/research/to-job-listing';
import { shouldUseSupabaseAdapter } from '@/lib/supabase/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  if (!shouldUseSupabaseAdapter()) {
    return NextResponse.json(
      { error: 'supabase adapter disabled - set NEXT_PUBLIC_PERSISTENCE_ADAPTER=supabase' },
      { status: 501 },
    );
  }
  try {
    const [jobs, prefs] = await Promise.all([listExternalJobs(), getSearchPreferences()]);
    const keywords = preferenceKeywords(prefs, []);
    const listings = jobs.map((job) => toJobListing(job, keywords));
    return NextResponse.json({ listings });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 503 },
    );
  }
}
```

- [ ] **Step 5: Run both tests — expect PASS**

Run: `npx vitest run tests/unit/research/to-job-listing.test.ts tests/unit/api/jobs-listings-route.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/research/to-job-listing.ts src/app/api/jobs/listings/route.ts \
        tests/unit/research/to-job-listing.test.ts tests/unit/api/jobs-listings-route.test.ts
git commit -m "feat: /api/jobs/listings — cached external jobs mapped to UI shape"
```

---

## Task 8: `GET /api/companies` (+ mapper) and `GET /api/research/picks`

Two read routes reusing the repo. Companies: map `ExternalCompany` → UI `Company` (slug id, initial letter, a deterministic bg colour), plus open-role counts derived from `external_jobs`, plus the `watched` flag. Picks: top-N external jobs by match score, excluding dismissed ids, mapped to `DailyPick`.

**Files:**
- Create: `src/lib/research/to-company.ts`, `src/lib/research/to-daily-pick.ts`
- Create: `src/app/api/companies/route.ts`, `src/app/api/research/picks/route.ts`
- Test: `tests/unit/research/to-company.test.ts`, `tests/unit/research/to-daily-pick.test.ts`

- [ ] **Step 1: Write failing mapper tests**

```ts
// to-company.test.ts
import { describe, expect, test } from 'vitest';
import { toCompany } from '@/lib/research/to-company';

describe('toCompany', () => {
  test('maps external company to UI Company with slug id + initial', () => {
    const c = toCompany(
      { sourceProvider: 'themuse', sourceId: 'acme-corp', name: 'Acme Corp', domain: 'acme.com', logoUrl: 'https://logo.clearbit.com/acme.com', raw: null },
      { openRoles: 3, watched: true },
    );
    expect(c.id).toBe('acme-corp');
    expect(c.name).toBe('Acme Corp');
    expect(c.initial).toBe('A');
    expect(c.domain).toBe('acme.com');
    expect(c.logoUrl).toBe('https://logo.clearbit.com/acme.com');
    expect(c.ring).toBe(true); // watched → ring
  });
});
```

```ts
// to-daily-pick.test.ts
import { describe, expect, test } from 'vitest';
import { toDailyPick } from '@/lib/research/to-daily-pick';

describe('toDailyPick', () => {
  test('formats salary band and why-bullets', () => {
    const pick = toDailyPick(
      { sourceProvider: 'themuse', sourceId: '5', title: 'Staff Eng', companyName: 'Globex', location: 'NYC', salaryMin: 180000, salaryMax: 220000, tags: ['go'], raw: null },
      92,
    );
    expect(pick.company).toBe('globex');
    expect(pick.role).toBe('Staff Eng');
    expect(pick.match).toBe(92);
    expect(pick.salary).toMatch(/\$180/);
    expect(Array.isArray(pick.why)).toBe(true);
    expect(pick.id).toBe('themuse:5');
  });
});
```

- [ ] **Step 2: Run — expect FAIL**, then implement both mappers

```ts
// src/lib/research/to-company.ts
import type { Company } from '@/lib/types';
import type { ExternalCompany } from '@/lib/api/types';

const BG_PALETTE = ['#2B2B45', '#3A2B45', '#2B453A', '#45402B', '#452B34', '#2B3A45'];

function bgFor(id: string): string {
  let sum = 0;
  for (const ch of id) sum += ch.charCodeAt(0);
  return BG_PALETTE[sum % BG_PALETTE.length]!;
}

export function toCompany(
  company: ExternalCompany,
  extra: { openRoles: number; watched: boolean },
): Company & { openRoles: number; watched: boolean } {
  const id = company.sourceId as Company['id'];
  return {
    id,
    name: company.name,
    bg: bgFor(id),
    initial: (company.name.trim()[0] ?? '?').toUpperCase(),
    ...(company.domain ? { domain: company.domain } : {}),
    ...(company.logoUrl ? { logoUrl: company.logoUrl } : {}),
    ...(extra.watched ? { ring: true } : {}),
    openRoles: extra.openRoles,
    watched: extra.watched,
  };
}
```

```ts
// src/lib/research/to-daily-pick.ts
import type { DailyPick } from '@/lib/types';
import type { ExternalJob } from '@/lib/api/types';
import { companySlug } from '@/lib/research/derive-companies';
import { externalJobKey } from '@/lib/research/to-job-listing';

function fmtSalary(min?: number, max?: number): string {
  if (!min && !max) return 'Not disclosed';
  const k = (n: number) => `$${Math.round(n / 1000)}k`;
  if (min && max) return `${k(min)}–${k(max)}`;
  return k((min ?? max)!);
}

export function toDailyPick(job: ExternalJob, match: number): DailyPick {
  return {
    id: externalJobKey(job) as DailyPick['id'],
    company: companySlug(job.companyName) as DailyPick['company'],
    role: job.title,
    location: job.location?.trim() || '—',
    salary: fmtSalary(job.salaryMin, job.salaryMax),
    match,
    why: (job.tags ?? []).slice(0, 3).map((t) => `Matches your interest in ${t}`),
    posted: (job.postedAt ?? '').slice(0, 10) || 'Recently',
    applicants: '—',
  };
}
```

- [ ] **Step 3: Implement `GET /api/companies`**

```ts
import { NextResponse } from 'next/server';

import {
  listExternalCompanies,
  listExternalJobs,
  listWatchedCompanyKeys,
} from '@/lib/repositories/supabase/research-repository';
import { companySlug } from '@/lib/research/derive-companies';
import { toCompany } from '@/lib/research/to-company';
import { shouldUseSupabaseAdapter } from '@/lib/supabase/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  if (!shouldUseSupabaseAdapter()) {
    return NextResponse.json({ error: 'supabase adapter disabled' }, { status: 501 });
  }
  try {
    const [companies, jobs, watchedKeys] = await Promise.all([
      listExternalCompanies(),
      listExternalJobs(),
      listWatchedCompanyKeys(),
    ]);
    const openRoles = new Map<string, number>();
    for (const job of jobs) {
      const key = companySlug(job.companyName);
      openRoles.set(key, (openRoles.get(key) ?? 0) + 1);
    }
    const watched = new Set(watchedKeys);
    const rows = companies.map((c) =>
      toCompany(c, { openRoles: openRoles.get(c.sourceId) ?? 0, watched: watched.has(c.sourceId) }),
    );
    return NextResponse.json({ companies: rows });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 503 },
    );
  }
}
```

- [ ] **Step 4: Implement `GET /api/research/picks`**

```ts
import { NextResponse } from 'next/server';

import { getSearchPreferences } from '@/lib/repositories/supabase/research-preferences-repository';
import {
  listDismissedPickIds,
  listExternalJobs,
} from '@/lib/repositories/supabase/research-repository';
import { computeMatchScore } from '@/lib/research/match-score';
import { preferenceKeywords } from '@/lib/research/preferences';
import { externalJobKey } from '@/lib/research/to-job-listing';
import { toDailyPick } from '@/lib/research/to-daily-pick';
import { shouldUseSupabaseAdapter } from '@/lib/supabase/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PICK_LIMIT = 8;

export async function GET() {
  if (!shouldUseSupabaseAdapter()) {
    return NextResponse.json({ error: 'supabase adapter disabled' }, { status: 501 });
  }
  try {
    const [jobs, prefs, dismissed] = await Promise.all([
      listExternalJobs(),
      getSearchPreferences(),
      listDismissedPickIds(),
    ]);
    const keywords = preferenceKeywords(prefs, []);
    const dismissedSet = new Set(dismissed);
    const picks = jobs
      .filter((job) => !dismissedSet.has(externalJobKey(job)))
      .map((job) => ({ job, score: computeMatchScore(job, keywords) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, PICK_LIMIT)
      .map(({ job, score }) => toDailyPick(job, score));
    return NextResponse.json({ picks, spotlight: picks[0] ?? null });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 503 },
    );
  }
}
```

> **Dismiss id note:** the client only holds the synthetic `provider:sourceId` key, so `dismissed_picks.external_job_id` is a `text` column (already set that way in Task 1's SQL — no uuid FK). `dismissPick(jobKey)` and this route's filter both use that synthetic key directly, `externalJobKey(job)`.

- [ ] **Step 5: Run mapper tests + typecheck — expect PASS**

Run: `npx vitest run tests/unit/research/to-company.test.ts tests/unit/research/to-daily-pick.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/research/to-company.ts src/lib/research/to-daily-pick.ts \
        src/app/api/companies/route.ts src/app/api/research/picks/route.ts \
        tests/unit/research/to-company.test.ts tests/unit/research/to-daily-pick.test.ts
git commit -m "feat: /api/companies + /api/research/picks read routes with mappers"
```

---

## Task 9: Action routes — watch/unwatch, dismiss, preferences

Small POST/DELETE routes the front-end calls for the write actions the design attaches to Companies/Research. Each is adapter-gated and Zod-validated.

**Files:**
- Create: `src/app/api/companies/watch/route.ts` (POST add, DELETE remove; body `{ companyKey }`)
- Create: `src/app/api/research/picks/dismiss/route.ts` (POST; body `{ jobKey }`)
- Create: `src/app/api/research/preferences/route.ts` (GET current, PUT update)
- Test: `tests/unit/api/research-preferences-route.test.ts`

- [ ] **Step 1: Write the failing preferences-route test**

```ts
import { describe, expect, test, vi } from 'vitest';

vi.mock('@/lib/supabase/env', () => ({ shouldUseSupabaseAdapter: () => true }));
const setSearchPreferences = vi.fn(async (p) => ({ keywords: ['react'], location: '', remote: 'any', ...p }));
vi.mock('@/lib/repositories/supabase/research-preferences-repository', () => ({
  getSearchPreferences: async () => ({ keywords: [], location: '', remote: 'any' }),
  setSearchPreferences: (p: unknown) => setSearchPreferences(p),
}));

import { PUT } from '@/app/api/research/preferences/route';

describe('PUT /api/research/preferences', () => {
  test('validates + persists preferences', async () => {
    const req = new Request('http://test/api/research/preferences', {
      method: 'PUT',
      body: JSON.stringify({ keywords: ['react'], location: 'NYC', remote: 'remote' }),
    });
    const res = await PUT(req);
    expect(res.status).toBe(200);
    expect(setSearchPreferences).toHaveBeenCalled();
  });

  test('rejects a malformed body', async () => {
    const req = new Request('http://test/api/research/preferences', {
      method: 'PUT',
      body: JSON.stringify({ remote: 123 }),
    });
    const res = await PUT(req);
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**, then implement the three routes

```ts
// src/app/api/research/preferences/route.ts
import { NextResponse } from 'next/server';
import { z } from 'zod';

import {
  getSearchPreferences,
  setSearchPreferences,
} from '@/lib/repositories/supabase/research-preferences-repository';
import { shouldUseSupabaseAdapter } from '@/lib/supabase/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const prefsSchema = z.object({
  keywords: z.array(z.string()).max(50).optional(),
  location: z.string().max(120).optional(),
  remote: z.enum(['remote', 'hybrid', 'onsite', 'any']).optional(),
});

export async function GET() {
  if (!shouldUseSupabaseAdapter()) return NextResponse.json({ error: 'adapter disabled' }, { status: 501 });
  try {
    return NextResponse.json({ preferences: await getSearchPreferences() });
  } catch (error) {
    return NextResponse.json({ error: msg(error) }, { status: 503 });
  }
}

export async function PUT(request: Request) {
  if (!shouldUseSupabaseAdapter()) return NextResponse.json({ error: 'adapter disabled' }, { status: 501 });
  const parsed = prefsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid body', issues: parsed.error.issues }, { status: 400 });
  }
  try {
    const preferences = await setSearchPreferences(parsed.data);
    return NextResponse.json({ ok: true, preferences });
  } catch (error) {
    return NextResponse.json({ error: msg(error) }, { status: 503 });
  }
}

function msg(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
```

```ts
// src/app/api/companies/watch/route.ts
import { NextResponse } from 'next/server';
import { z } from 'zod';

import {
  addWatchedCompany,
  removeWatchedCompany,
} from '@/lib/repositories/supabase/research-repository';
import { shouldUseSupabaseAdapter } from '@/lib/supabase/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({ companyKey: z.string().min(1).max(200) });

export async function POST(request: Request) {
  return mutate(request, addWatchedCompany);
}
export async function DELETE(request: Request) {
  return mutate(request, removeWatchedCompany);
}

async function mutate(request: Request, fn: (key: string) => Promise<void>) {
  if (!shouldUseSupabaseAdapter()) return NextResponse.json({ error: 'adapter disabled' }, { status: 501 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  try {
    await fn(parsed.data.companyKey);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 503 });
  }
}
```

```ts
// src/app/api/research/picks/dismiss/route.ts
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { dismissPick } from '@/lib/repositories/supabase/research-repository';
import { shouldUseSupabaseAdapter } from '@/lib/supabase/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({ jobKey: z.string().min(1).max(200) });

export async function POST(request: Request) {
  if (!shouldUseSupabaseAdapter()) return NextResponse.json({ error: 'adapter disabled' }, { status: 501 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  try {
    await dismissPick(parsed.data.jobKey);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 503 });
  }
}
```

> If Task 8 chose option (a) (synthetic `text` key), `dismissPick` takes the synthetic `jobKey` directly — consistent with this route. Keep them aligned.

- [ ] **Step 3: Run the preferences test — expect PASS**

Run: `npx vitest run tests/unit/api/research-preferences-route.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/research/preferences/route.ts src/app/api/companies/watch/route.ts \
        src/app/api/research/picks/dismiss/route.ts tests/unit/api/research-preferences-route.test.ts
git commit -m "feat: action routes — watch, dismiss, preferences CRUD"
```

---

## Task 10: Client data hooks (adapter-aware fetch)

Small client hooks that fetch the new read routes when the adapter is `supabase`, and fall back to seed constants when it's `local` (so the demo keeps working and tests stay green). Mirrors the existing client fallback pattern used elsewhere in the app.

**Files:**
- Create: `src/lib/client/use-live-listings.ts`, `src/lib/client/use-live-companies.ts`, `src/lib/client/use-live-picks.ts`
- (Optional) Create: `tests/unit/client/use-live-listings.test.ts` if the repo tests client hooks elsewhere; otherwise cover via Playwright in Task 13.

- [ ] **Step 1: Implement `useLiveListings` (pattern; repeat shape for companies/picks)**

```ts
'use client';

import { useEffect, useState } from 'react';
import { JOB_LISTINGS } from '@/lib/data/seed';
import type { JobListing } from '@/lib/types';

const isSupabase = process.env.NEXT_PUBLIC_PERSISTENCE_ADAPTER === 'supabase';

export function useLiveListings(): { listings: JobListing[]; loading: boolean; error: string | null } {
  const [listings, setListings] = useState<JobListing[]>(isSupabase ? [] : JOB_LISTINGS);
  const [loading, setLoading] = useState(isSupabase);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabase) return;
    let active = true;
    (async () => {
      try {
        const res = await fetch('/api/jobs/listings');
        if (!res.ok) throw new Error(`listings ${res.status}`);
        const body = (await res.json()) as { listings: JobListing[] };
        if (active) setListings(body.listings);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return { listings, loading, error };
}
```

`useLiveCompanies` fetches `/api/companies` (fallback: derive from `COMPANIES` seed, `watched: false`, `openRoles: 0`). `useLivePicks` fetches `/api/research/picks` (fallback: `DAILY_PICKS` seed, `spotlight: DAILY_PICKS[0]`).

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/client/use-live-listings.ts src/lib/client/use-live-companies.ts src/lib/client/use-live-picks.ts
git commit -m "feat: adapter-aware client hooks for live listings/companies/picks"
```

---

## Task 11: Wire JobsView to live listings

Replace the `JOB_LISTINGS` seed import in Jobs with `useLiveListings()`; compute scope counts from real data; keep tracked rows from the store; make the preview dialog show the real description + `Apply on company site` link.

**Files:**
- Modify: `src/components/jobs/JobsView.tsx` (swap `JOB_LISTINGS` for the hook; counts: `matched` = listings with `match ≥ 60`, `open` = all listings)
- Modify: `src/components/jobs/use-jobs-rows.ts` if the scope math references the seed length
- Modify: `src/components/jobs/JobListingPreviewDialog.tsx` (render `description`, `applyUrl`)

- [ ] **Step 1: Swap the data source in `JobsView.tsx`**

Replace `import { JOB_LISTINGS, STATUSES } from '@/lib/data/seed';` with `import { STATUSES } from '@/lib/data/seed';` + `import { useLiveListings } from '@/lib/client/use-live-listings';`. Inside the component: `const { listings, loading } = useLiveListings();` then use `listings` everywhere `JOB_LISTINGS` was used. Counts:

```ts
const counts = useMemo(
  () => ({
    all: applications.length + listings.length,
    tracked: applications.length,
    matched: listings.filter((l) => l.match >= 60).length,
    open: listings.length,
  }),
  [applications.length, listings],
);
```

- [ ] **Step 2: Empty + loading state**

When `loading` show the existing skeleton/empty pattern; when `!loading && listings.length === 0 && isSupabase` show an empty state with a "Fetch live jobs" button that POSTs `/api/research/run` then re-fetches (design §8). Reuse the AppShell empty-state class already present.

- [ ] **Step 3: Preview dialog real fields**

In `JobListingPreviewDialog.tsx`, render the listing `description` (add it to the `JobListing`-derived row if not already carried — carry `description` and `applyUrl` through `toJobListing` by extending the row type used by the dialog, or fetch-on-open). Add an `Apply on company site` anchor to `applyUrl` when present; hide it otherwise.

> **Impl note:** `JobListing` has no `description`/`applyUrl` today. Simplest: add `description?: string` and `applyUrl?: string` to the row object the Jobs table builds (not the shared `JobListing` type), sourced from the API response — extend the `/api/jobs/listings` payload to include them and widen the client type locally. Keep `src/lib/types.ts` `JobListing` unchanged to avoid touching seed typing.

- [ ] **Step 4: Verify**

Run: `npm run typecheck && npx vitest run && npm run build`
Expected: PASS. Existing Jobs tests still green with adapter `local` (fallback returns seed).

- [ ] **Step 5: Commit**

```bash
git add src/components/jobs/
git commit -m "feat: Jobs view backed by live listings with real preview + fetch CTA"
```

---

## Task 12: Wire CompaniesView + ResearchView to live data

**Files:**
- Modify: `src/components/companies/CompaniesView.tsx`, `src/components/companies/CompanyDetailDialog.tsx`
- Modify: `src/components/research/ResearchView.tsx`
- Create: `src/components/research/SearchPreferencesDialog.tsx`

- [ ] **Step 1: Companies list + bookmark + site link**

Swap the seed `COMPANIES`/`COMPANIES_WATCH` usage for `useLiveCompanies()`. Render open-role count and "N on board" (board count from `useAppsStore`). **Site** → `href={company.domain ? 'https://' + company.domain : undefined}` (hide when no domain). **Bookmark** → optimistic toggle calling `POST`/`DELETE /api/companies/watch` with `{ companyKey: company.id }`; star fills when `watched`. In `CompanyDetailDialog`, render unknown fields as `—`; keep Glassdoor-style rating/CEO/recommend rows behind the existing "demo" label.

- [ ] **Step 2: Research picks + spotlight + dismiss**

In `ResearchView.tsx`, swap `DAILY_PICKS` for `useLivePicks()`. Daily spotlight = `spotlight`. **Add to wishlist** already calls the store `addToWishlist` — keep it (it persists through the board write-through). **Open** opens the listing detail. **Dismiss** → optimistic remove + `POST /api/research/picks/dismiss` `{ jobKey: pick.id }`.

- [ ] **Step 3: Watched companies section + "watch another"**

Render watched companies from `useLiveCompanies()` filtered to `watched`. "Watch another company" opens a small dialog (name/domain input) → `POST /api/companies/watch` with `{ companyKey: slug(name) }` (import `companySlug`). "Manage list" reuses the same list with remove buttons → `DELETE`.

- [ ] **Step 4: Pipeline analytics from board data**

Compute KPIs from `useAppsStore` applications: open apps (non-terminal statuses), offers (offer status count), applied count. Keep charts with no real source (momentum response-rate, total-comp, skill-demand, LinkedIn) behind their existing "demo data" labels — do not remove them (design §7).

- [ ] **Step 5: Search-preferences dialog ("Tune preferences" becomes real)**

`SearchPreferencesDialog.tsx`: loads `GET /api/research/preferences`, edits keywords (chips) + location + remote select, saves via `PUT`. On save, toast + trigger a `/api/research/run` refresh. Wire the existing "Tune preferences" button to open it.

- [ ] **Step 6: Refresh button**

Add a visible **Refresh** button on Research → `POST /api/research/run`, show a spinner, toast the summary (`jobsUpserted`, any provider `errors`), then re-fetch picks/companies.

- [ ] **Step 7: Verify**

Run: `npm run typecheck && npx vitest run && npm run build`
Expected: PASS; existing Companies/Research tests green under `local`.

- [ ] **Step 8: Commit**

```bash
git add src/components/companies/ src/components/research/
git commit -m "feat: Companies + Research views on live data (watch, dismiss, prefs, refresh)"
```

---

## Task 13: Operator config + local smoke with real Supabase

**Files:**
- Modify: `.env.local` (Nick's machine — not committed)
- Modify: `docs/deployment/release-checklist.md` (document new env vars)
- Reference: Vercel project env (via `vercel env` or dashboard)

- [ ] **Step 1: Add env vars to `.env.local`**

```
NEXT_PUBLIC_PERSISTENCE_ADAPTER=supabase
CRON_SECRET=<generate: openssl rand -hex 32>
# Adzuna (optional — pipeline runs on The Muse alone until these are set):
ADZUNA_APP_ID=
ADZUNA_APP_KEY=
ADZUNA_COUNTRY=us
```

- [ ] **Step 2: Ensure the owner user + profiles row exist**

The board tables already have the owner (`users` has 1 row). Confirm a `profiles` row for `DEMO_USER_ID` exists (create an empty one if not, so preferences upserts have a home) via `mcp__supabase__execute_sql`:

```sql
insert into public.profiles (owner_user_id, payload, updated_at)
values ('00000000-0000-0000-0000-000000000001', '{}'::jsonb, now())
on conflict (owner_user_id) do nothing;
```

- [ ] **Step 3: Local smoke**

Start the dev server. Trigger a refresh: `curl -XPOST localhost:3000/api/research/run`. Expect JSON `{ ok: true, jobsUpserted: >0, ... }` (The Muse returns jobs). Then `curl localhost:3000/api/jobs/listings` → non-empty `listings`. Load `/jobs`, `/companies`, `/research` in the browser and verify live rows render.

- [ ] **Step 4: Document + commit checklist update**

```bash
git add docs/deployment/release-checklist.md
git commit -m "docs: document research env vars + refresh smoke steps"
```

> Adzuna signup (developer.adzuna.com) is Nick's one manual step (design §11); leave the keys blank until then — the pipeline degrades gracefully.

---

## Task 14: E2E + full verification

**Files:**
- Create: `tests/e2e/research-live.spec.ts` (Playwright)
- Reference: existing e2e patterns in `tests/e2e/`

- [ ] **Step 1: Write a smoke e2e (seed the DB, drive the flow)**

Per design §10: seed `external_jobs` (insert a fixture row via the admin client or a test setup route), load `/jobs`, wishlist a listing, apply it, verify it appears on the board and survives a reload. Follow the existing e2e harness (adapter flag, base URL). If e2e requires live Supabase, gate the spec behind an env check so CI without secrets skips it (match how the existing `clean-slate persistence e2e for supabase mode` spec, commit 31f06e2, guards itself).

- [ ] **Step 2: Full suite**

Run: `npm run lint && npm run typecheck && npx vitest run && npm run build`
Expected: all PASS.

- [ ] **Step 3: E2E**

Run the Playwright suite the way the repo does (check `package.json` for the `e2e` script). Expected: PASS or cleanly-skipped when secrets absent.

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/research-live.spec.ts
git commit -m "test: live research/jobs e2e smoke (supabase mode)"
```

---

## Task 15: Finish the branch

- [ ] **Step 1: Self-review the diff** against the design spec §7 page-by-page checklist. Confirm every listed action is real or explicitly labeled demo.

- [ ] **Step 2: Push + open PR into `Development`**

```bash
git push -u origin feature/real-data-jobs-companies-research
gh pr create --base Development --title "Real data for Jobs / Companies / Research (single-user)" \
  --body "Implements docs/superpowers/specs/2026-07-06-real-data-single-user-design.md: live job/company data via The Muse (Adzuna key-ready), cached in Supabase, with real card actions. Adapter flag remains the kill switch.

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

- [ ] **Step 3: Restore the stashed Prettier tweaks** if still relevant, or drop the stash: `git stash drop` (they were cosmetic reflows on the already-merged documents branch).

- [ ] **Step 4: Use superpowers:finishing-a-development-branch** to decide merge/PR/cleanup.

---

## Self-review against the spec

- **§3 single-user model** → owner via `getOwnerUserId()`; client never talks to Supabase (all routes service-role). ✅ (Tasks 3–9)
- **§4 database** → trimmed migration (Task 1). ✅ (RBAC/quota/credentials deferred per §2.)
- **§5 write-through board** → unchanged; already shipped. Wishlist/apply persist through the existing store (Tasks 11–12 reuse `addToWishlist`/`applyCard`). ✅
- **§6 providers + preferences + refresh + match score** → Tasks 2, 3, 6, 12. The Muse enabled; Adzuna key-ready; Clearbit logos via `deriveCompaniesFromJobs`. ✅
- **§7 Jobs** → Task 11 (listings, scopes, matched≥60, preview description + applyUrl). ✅
- **§7 Companies** → Task 12 (external ∪ board, site link, bookmark→watched, `—` for unknowns). ✅
- **§7 Research** → Task 12 (picks/spotlight/dismiss, watched companies, pipeline KPIs, See-all-matches link, labeled demos kept). ✅
- **§8 error handling** → routes return 501/503 typed errors; client hooks fall back to cache/seed; pipeline tolerates provider errors (Task 6). ✅
- **§9 configuration** → Task 13; adapter flag kill switch preserved (routes 501 under `local`). ✅
- **§10 testing** → provider normalisers already exist; match-score, mappers, pipeline, route, and preferences tests (Tasks 2–9); Playwright smoke (Task 14). ✅
- **§11 operator setup** → Task 13; Adzuna signup flagged as the sole manual step. ✅

**Open items flagged for implementation-time verification:** (1) `profiles` `onConflict` column — verify the PK/unique is `owner_user_id` against `supabase-bootstrap.sql` in Task 3. (2) `See all matches` links to `/jobs?scope=matched` — confirm the Jobs URL param supports `scope=matched` (it does, per `use-jobs-rows.ts`). (3) Confirm the `e2e` npm script name in Task 14.
