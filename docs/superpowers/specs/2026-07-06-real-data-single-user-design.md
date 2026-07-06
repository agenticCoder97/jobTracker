# Real data for Jobs / Companies / Research (single-user) — design

- **Date**: 2026-07-06
- **Status**: Approved, then **deferred to Round 3** — see
  `2026-07-06-home-board-supabase-design.md` for the amended Round 1 scope (Home board
  + manual tracking + Supabase persistence). The single-user model, database choice,
  and adapter architecture in this doc still stand; the live-API / Research /
  Companies work lands after Round 1 (board) and Round 2 (Outlook email auto-import).
- **Scope**: Replace mock/seed data with Supabase persistence + live job APIs for the Jobs, Companies, and Research pages, including all card actions, for a single user. No auth this round.

## 1. Goals

1. All functionality on Jobs, Companies, and Research works for real — every visible button either performs a real action or is explicitly labeled demo.
2. Board data (applications, activity, docs) persists in Supabase and survives across browsers/devices.
3. Job listings and company profiles come from live external APIs (The Muse + Adzuna), cached in Supabase.
4. Auth can be added later without schema or architecture rework.

## 2. Non-goals (this round)

- User auth / multi-tenancy. One hardcoded owner user.
- RBAC tables, API quota tracking, encrypted credential storage (from draft migration 0002) — deferred.
- LinkedIn / Glassdoor integrations — no legal free API; stubs stay marked.
- Migrating profile/resumes/cover letters to Supabase — they stay in localStorage; the Apply flow keeps working unchanged.
- Research sections with no real data source (LinkedIn signals, momentum response-rate, market salary/skill charts) — stay visible with existing "demo data" labels.

## 3. Single-user model

- The drafted schema keys every row on `owner_user_id` with RLS against `auth.uid()`. Without auth, the browser can never satisfy RLS, so **the client never talks to Supabase directly**.
- All reads/writes flow through Next.js route handlers / server actions using the service-role client (`src/lib/supabase/admin.ts`).
- A single owner user is created once via the Supabase auth admin API with the fixed UUID `00000000-0000-0000-0000-000000000001` (matches the seed constant), plus a matching `public.users` row.
- The owner ID is resolved server-side by a `getOwnerUserId()` helper. When auth lands, that helper reads the session instead — no schema change, no caller changes.

## 4. Database

Project: existing Supabase project **saisai** (`zpfvdswiaiqoptfsafpd`, us-east-2), currently paused → restore it.

Migrations applied via the Supabase integration and mirrored in `docs/backend/migrations/`:

- **0001_bootstrap** — `docs/backend/supabase-bootstrap.sql` as-is: `users`, `applications`, `application_activity`, `app_docs`, `profiles`, `resumes`, `cover_letters`, `notifications`, `audit_events`, `app_logs`, all with RLS.
- **0002_research (trimmed from draft)** — only:
  - `external_jobs(id, source_provider, source_id, payload jsonb, fetched_at, expires_at, unique(source_provider, source_id))`
  - `external_companies(same shape)`
  - `watched_companies(owner_user_id, company_key, added_at)`
  - `dismissed_picks(owner_user_id, external_job_id, dismissed_at)` — new, backs the pick "Dismiss" action
  - `api_call_log` (as drafted)
  - `cron_runs` (as drafted)
  - RLS: owner-scoped for `watched_companies`/`dismissed_picks`; `external_*`, `api_call_log`, `cron_runs` are service-role only (no anon policies needed since the client never connects).

JSONB-first payloads are kept (same as v1 design); hot fields normalise into columns later if needed.

## 5. Architecture: write-through adapter behind Zustand

`useAppsStore` keeps its current shape, optimistic updates, and localStorage persist (which becomes an offline cache).

- **Hydration**: on first load the store fetches `GET /api/apps` (server reads Supabase with service role) and replaces seed data. `skipHydration` flow stays.
- **First-run import**: if the DB has zero applications and localStorage has some, the client POSTs its current board to `POST /api/apps/import` once, so the existing demo board carries over instead of vanishing.
- **Write-through**: every mutation (`createCard`, `updateApp`, `moveStatus`, `reorderInStatus`, `addComment`, `addToWishlist`, `applyCard`) applies locally first (unchanged), then calls a server endpoint that upserts the JSONB payload row (`applications`, `application_activity`, `app_docs`). Fire-and-forget with retry-once; on persistent failure, a toast warns that the change is saved locally only.
- **Reset** clears both localStorage and (behind a confirm) the owner's DB rows.
- Audit events (`recordAudit`) dual-write to `audit_events` through the same server layer.

## 6. Live discovery data

### Providers

| Provider | Status | Auth |
| --- | --- | --- |
| The Muse | Already written (`src/lib/api/providers/themuse.ts`) — enable | none |
| Adzuna | Implement `searchJobs` | `ADZUNA_APP_ID` + `ADZUNA_APP_KEY` (free tier; Nick signs up) |
| Clearbit logo | Enable for company logos | none |
| JSearch / LinkedIn / Glassdoor | Stay stubs, marked | — |

### Search preferences ("Tune preferences" becomes real)

A small preferences object `{ keywords: string[], location: string, remote: 'remote'|'hybrid'|'onsite'|'any' }` stored in the owner's `profiles.payload`. Editable from a panel/dialog on Research. Drives both cron and manual fetches.

### Refresh pipeline

- `POST /api/research/run` (existing stub route): loads preferences → fans out across enabled job providers via `registry.ts` → normalises to `ExternalJob` → upserts into `external_jobs` (keyed on `source_provider, source_id`) → derives/upserts `external_companies` (company name/domain from listings; logo via Clearbit) → writes one `api_call_log` row per provider call and one `cron_runs` row per run.
- `GET /api/cron/research` (existing stub, already scheduled every 6h in `vercel.json`, guarded by `CRON_SECRET`) calls the same pipeline.
- A visible **Refresh** button on Research triggers the manual route and reports progress/toast.
- **Match score**: computed server-side per job — keyword overlap between preference keywords + profile resume keywords and the job title/tags/description, normalised to 0–100. Simple and deterministic; can get smarter later.

## 7. Page-by-page behaviour

### Jobs

- "Open positions" rows come from `GET /api/jobs/listings` (server reads `external_jobs`, maps to the existing `JobListing` UI shape, attaches match score) instead of the `JOB_LISTINGS` seed. Tracked rows unchanged (store).
- Counts/scopes (`all/tracked/matched/open`) computed from real data; "matched" = listings above a match threshold (≥60).
- **Wishlist / Apply / Track** actions persist through the write-through adapter.
- Listing preview dialog shows the real description and a real "Apply on company site" link (`applyUrl`).

### Companies

- Rows derived from `external_companies` merged with companies present on the board (`GET /api/companies`).
- Real fields: name, logo, domain, industry, HQ/location where the API provides them, open-role count (count of that company's rows in `external_jobs`), "N on board" chip (from store).
- Glassdoor-style rating / CEO approval / recommend% keep the "demo" label where shown (no real source).
- **Site** → real external link to the company domain (hidden if domain unknown). **Bookmark** → toggles a `watched_companies` row (star fills when watched).
- Company detail dialog keeps working for both seeded and external companies; unknown fields render as "—" rather than fake numbers.

### Research

- **Daily picks**: top N (8) external jobs by match score, excluding dismissed and already-wishlisted ones (`GET /api/research/picks`). **Add to wishlist** (already real) persists; **Open** opens the listing detail; **Dismiss** persists to `dismissed_picks`.
- **Daily spotlight**: the top pick.
- **Watched companies**: real list from `watched_companies` joined with `external_companies`/board data; **Watch another company** opens a dialog (name or domain) that adds a row; **Manage list** allows removal.
- **Pipeline analytics**: KPIs computed from actual board data (open apps, offers, applied counts, avg days between `applied` and first response event where derivable). Cards whose metric can't be computed from real data yet keep the demo label.
- **See all matches** → links to `/jobs?scope=matched`.
- **Kept as labeled demos**: momentum response-rate stats, total-comp-by-level chart, skill-demand chart, LinkedIn signals.

## 8. Error handling

- Provider call failures: recorded in `api_call_log` with `error`, surfaced as a toast on manual refresh; pipeline continues with remaining providers. Pages render last-cached DB rows — never a blank screen.
- Empty cache (first run before any fetch): Jobs/Research show an empty state with a "Fetch live jobs" CTA wired to the refresh route.
- DB unreachable from the server: API routes return 503 with a typed error; the store falls back to its localStorage cache and shows a warning banner.
- Write-through failure: local state kept, toast "saved locally only — will not sync".

## 9. Configuration

`.env.local` (and the same in Vercel project settings):

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
NEXT_PUBLIC_PERSISTENCE_ADAPTER=supabase
ADZUNA_APP_ID=...
ADZUNA_APP_KEY=...
CRON_SECRET=...
```

The app must still boot with `NEXT_PUBLIC_PERSISTENCE_ADAPTER=local` (current demo behaviour) — the adapter flag remains the kill switch.

## 10. Testing

- **Vitest**: provider normalisers (The Muse, Adzuna fixtures → `ExternalJob`), match-score function, write-through adapter (mutation → correct endpoint payload), route handlers with a mocked Supabase client.
- **Playwright**: smoke — seed DB, load Jobs, wishlist a listing, apply it, verify it appears on the board and survives a reload.
- Existing test suites keep passing with the adapter flag set to `local`.

## 11. Operator setup (Nick)

1. Sign up at developer.adzuna.com for a free App ID/key (only manual step).
2. Everything else (project restore, migrations, owner user creation, env setup locally and on Vercel) is done by Claude via the Supabase/Vercel integrations.
