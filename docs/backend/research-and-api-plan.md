# Research, API integration, RBAC, audit & analytics — plan

> Status: **templates only** in this pass. Schema is drafted but **not** applied to the live DB. Provider modules are stubs. Cron is wired but disabled. Implementation comes later — see "Phasing" at the bottom.

## 1. Goal

Replace the seed-data Research tab with live data sourced from external job/company APIs, scheduled via a Vercel cron, with end-to-end auditability (server domain truth + UI telemetry + outbound API call log) and an RBAC layer so admin/system roles can do things ordinary users cannot.

## 2. Honest constraints on "scraping LinkedIn / Glassdoor"

Both platforms forbid unauthenticated scraping in their ToS. There is **no free public API** for either:

- **LinkedIn** — the public REST API requires Talent/Marketing partner approval. Public-page scraping is contractually prohibited and routinely blocked (auth wall, JS-rendered pages, IP bans). Bypassing those is dual-use territory we shouldn't ship in a hosted product.
- **Glassdoor** — the partner API was deprecated in 2021. No public replacement.

The architecture below treats every external source as a **provider plug-in** behind a `JobProvider` / `CompanyProvider` interface. We can ship LinkedIn/Glassdoor stubs (clearly marked) so the plumbing works, but the *seeded* providers should be ones that are legal to call without a partner agreement:

| Provider | Coverage | Auth | Notes |
| --- | --- | --- | --- |
| Adzuna | Jobs (US/UK/30+ countries), salary stats | App ID + key, free tier | Best general-purpose seed |
| The Muse | Jobs + curated company profiles | Public, no key | Limited to participating companies |
| JSearch (RapidAPI) | Aggregates LinkedIn/Indeed/Glassdoor postings | RapidAPI key, paid tiers | Lawful aggregation since RapidAPI sits on partner data |
| Remotive API | Remote-only software roles | Public JSON, no key | Useful zero-config daily fallback; preserve Remotive listing URLs for attribution |
| Clearbit Logo API | Company logos by domain | Public, no key | Already useful for our `CompanyLogo` |
| OpenCorporates | Company registry data | Free tier with key | Legal entity data, not employer brand |

LinkedIn / Glassdoor stubs stay in-tree with a `// TODO: requires partner approval` marker so a future operator with credentials can drop in their own client.

## 3. Schema additions (see `migrations/0002_research_rbac_analytics.sql`)

### 3.1 RBAC

```
roles(id text pk, label text, description text)
permissions(id text pk, label text)
role_permissions(role_id, permission_id)
user_roles(user_id, role_id)
```

Seed roles: `admin`, `user`, `system`. Permissions are coarse for v1 (`research:read`, `research:write`, `admin:read_all`, `admin:manage_providers`).

Helper SQL function (security definer, called from RLS):

```sql
public.user_has_role(uid uuid, role_id text) returns boolean
```

Existing tables get an admin-override clause:

```sql
using (owner_user_id = auth.uid() or public.user_has_role(auth.uid(), 'admin'))
```

### 3.2 API integration

```
api_providers(id text pk, name, kind, enabled bool, base_url, auth_kind, ...)
api_credentials(provider_id, key_name, value_enc, created_at)  -- service_role only
api_call_log(id, provider_id, request_path, status, latency_ms, ratelimit_remaining,
             owner_user_id?, error?, created_at)
api_quota(provider_id, window_started_at, count, limit)
```

`api_credentials.value_enc` is encrypted with `pgsodium`/`pgcrypto`; client roles never see this table. Reads go through a service-role server module (`src/lib/supabase/admin.ts`).

### 3.3 Research data

```
external_companies(id, source_provider, source_id, payload jsonb, fetched_at, expires_at,
                   unique(source_provider, source_id))
external_jobs(id, source_provider, source_id, payload jsonb, fetched_at, expires_at,
              unique(source_provider, source_id))
research_subscriptions(id, owner_user_id, query jsonb, cadence_cron, last_run_at, enabled)
research_results(id, subscription_id, external_job_id, score numeric, matched_at)
watched_companies(owner_user_id, company_key, added_at)
```

`payload jsonb` keeps the same JSONB-first design as v1; we can normalise hot fields into columns once we know what the UI actually queries.

### 3.4 Analytics & user actions

```
user_actions(id, owner_user_id, kind, target, metadata jsonb, occurred_at)
```

Distinct from `audit_events`:

| Table | Owner | Purpose |
| --- | --- | --- |
| `audit_events` | server domain truth | Activity-tab history, recovery, legal trail |
| `app_logs` | server runtime | Errors, warnings, info — service-role write only |
| `user_actions` | client telemetry | Page views, filter changes, drag-drop frequency, A/B signals |
| `api_call_log` | server outbound | Debugging, cost & quota tracking |

### 3.5 Cron tracking

```
cron_runs(id, job_id text, started_at, finished_at, status, items_processed, error?)
```

## 4. Code architecture

```
src/lib/
  supabase/
    client.ts           ← browser (existing)
    server.ts           ← SSR cookie-aware (existing)
    admin.ts            ← NEW: service-role, server-only, no cookies
    env.ts              ← NEW vars: SUPABASE_SERVICE_ROLE_KEY, CRON_SECRET
  rbac/
    types.ts            ← Role, Permission types + canonical role IDs
    policies.ts         ← assertCan(), getRoles(), guardServerAction()
  api/
    types.ts            ← JobProvider / CompanyProvider interfaces
    client.ts           ← fetchWithRetry + apiCallLog hook
    registry.ts         ← provider lookup by id
    providers/
      adzuna.ts
      themuse.ts
      jsearch.ts
      clearbit-logo.ts
      linkedin.ts       ← stub, ToS-flagged
      glassdoor.ts      ← stub, ToS-flagged
  analytics/
    events.ts           ← typed event catalogue
    track.ts            ← single emit fn (writes user_actions + Vercel)
  repositories/
    types.ts            ← +ApiCallLogRepository, UserActionRepository contracts
    index.ts            ← wire all three repos through adapter switch
    local/              ← in-memory implementations for dev/test
    supabase/           ← real Supabase implementations

src/app/api/
  cron/
    research/route.ts   ← Vercel cron, CRON_SECRET-gated
    _auth.ts            ← assertCronAuth() helper
  research/
    run/route.ts        ← manual trigger (admin-only)

vercel.json             ← cron schedule entry
```

## 5. Cron flow

```
Vercel cron  ──► /api/cron/research
                    │
                    ├─ assertCronAuth()        (rejects unless x-vercel-cron header
                    │                           or Authorization: Bearer ${CRON_SECRET})
                    ├─ open cron_runs row
                    ├─ for each due research_subscription:
                    │     ├─ for each enabled provider:
                    │     │     ├─ provider.searchJobs(query)
                    │     │     ├─ apiCallLog.append(...)
                    │     │     ├─ upsert external_jobs
                    │     │     └─ score & write research_results
                    │     └─ enqueue notifications for new high-match items
                    └─ close cron_runs row
```

Default schedule: `0 13 * * *` (daily at 13:00 UTC, compatible with Vercel Hobby and morning Pacific time). Tunable per-subscription via `cadence_cron`.

## 6. Logging & analytics wiring

- **Vercel Analytics + Speed Insights** — already in `package.json`; mounted in `src/app/layout.tsx`.
- **Vercel Log Drain → Supabase** — configured in the Vercel dashboard (one-time, document in `docs/deployment/release-checklist.md`). Drain writes to a `vercel_logs` table via Supabase HTTP edge function (out of scope for this pass).
- **In-app server logs** — `eventLog.appendLog()` writes to `app_logs` (service-role) and to `console.{warn,error}` in dev.
- **Client-side telemetry** — `track(event, payload)` emits both to Vercel Analytics (`window.va?.track(...)`) and to `user_actions` via a debounced server action.

## 7. Security & RLS posture

- All new user-owned tables use the same `owner_user_id = auth.uid() OR user_has_role(auth.uid(), 'admin')` policy.
- `api_credentials` and `app_logs`: `service_role` only; revoke `select`/`insert` from `anon`/`authenticated`.
- `cron_runs`: admin read, service-role write.
- `user_has_role()` is `security definer` with `search_path = pg_catalog, public` and `grant execute` only to `authenticated, service_role`.
- Fix the existing `rls_auto_enable` advisor warning: `revoke execute on function public.rls_auto_enable() from anon, authenticated, public` (the event-trigger binding stays).

## 8. Functionality the Research tab can ship once data is live

Anchor: today the page renders entirely from `src/lib/data/seed.ts`. After this stack lands, every section can be backed by real data.

| Section | Data source | New value |
| --- | --- | --- |
| Daily spotlight / picks | `research_results` ranked by `score` desc | Real, personalised, refreshed every cron run |
| Search momentum | `audit_events` aggregations (applied, response_received, etc.) | True funnel from user's own actions |
| Pipeline analytics | Same | Replaces hard-coded percentages |
| Companies to watch | `watched_companies` ⨝ `external_companies` | User-curated, with diff alerts when new postings hit |
| Market salaries | Adzuna `/salary` endpoint, cached in `external_jobs.payload` | Real percentile bands by role/region |
| In-demand skills | Aggregated tag frequency over `external_jobs` | Trend line over last N runs |
| LinkedIn rail | Manual import (PDF/CSV) until partner API | Honest about scope; no scraping |
| Events / inMail | Stays demo-only or removed | Demo data is misleading once rest is live |

Worth adding:

- **Saved searches manager** — CRUD over `research_subscriptions`, with cadence + quiet-hours.
- **"New since you last looked" badge** — derived from `research_results.matched_at > user.last_research_open`.
- **Hidden gem filter** — recently posted, low applicants, high match score.
- **Per-provider attribution** — every card cites which provider it came from + when it was fetched (trust signal).

## 9. Phasing

| Phase | Scope | Files touched | Deferred |
| --- | --- | --- | --- |
| **0 — this pass (templates)** | Plan doc, migration SQL (un-applied), provider/RBAC/analytics scaffolds, real Supabase repos for event-log + api-call-log + user-actions, cron route gated by CRON_SECRET, vercel.json cron entry | Everything listed in §4 | Live API keys, applying migration, enabling cron, partner-only providers |
| 1 | Apply migration; revoke `rls_auto_enable` execute; add Adzuna + The Muse credentials; wire env vars locally + Vercel | `vercel env`, Supabase dashboard | Cron still disabled |
| 2 | Implement provider clients fully; manual `/api/research/run` works for one user | `src/lib/api/providers/*` | Cron still disabled |
| 3 | Enable cron schedule; wire research subscription CRUD UI | `vercel.json`, `src/app/research/*` | Auth |
| 4 | Replace seed data in ResearchView with live queries; add "saved searches" manager | `src/components/research/*` | Auth |
| 5 | Add Supabase email + magic link auth; replace `DEMO_USER_ID` with `auth.uid()` | `src/app/(auth)/*` | LinkedIn/Glassdoor |

Each phase is independently shippable; the local adapter remains a working fallback.
