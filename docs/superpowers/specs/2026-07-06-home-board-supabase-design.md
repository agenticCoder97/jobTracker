# Home board: real tracking with Supabase (single-user) — design

- **Date**: 2026-07-06
- **Status**: Amended scope, approved direction (chat); supersedes the *scope* of
  `2026-07-06-real-data-single-user-design.md` for this round. That spec's live-API /
  Research / Companies work is **deferred to Round 3**.
- **Scope**: Make the Home tab (kanban board) and card interactions fully real for a
  single user: manual application entry with free-form companies, editable card
  details, archive/delete, and Supabase persistence. No auth.

## Roadmap context

| Round | Scope | Spec |
| --- | --- | --- |
| **1 (this)** | Home board + card interactions + manual entry + Supabase persistence | this doc |
| 2 | Outlook email auto-import (poll nikhil_netra@hotmail.com via Microsoft Graph, parse application-confirmation emails, auto-create cards) | future spec |
| 3 | Live job APIs, Research, Companies pages | `2026-07-06-real-data-single-user-design.md` |

## 1. Goals

1. Track a real job application end-to-end from the Home tab alone: create it manually
   with real details (any company, not just seeded ones), move it through statuses,
   edit its fields, comment on it, archive or delete it.
2. All of it persists in Supabase and survives across browsers/devices.
3. Auth can be added later without rework (same single-user model as the v1 spec).

## 2. Non-goals (this round)

- Live job/company APIs, Research page, Companies page changes (Round 3).
- Email ingestion (Round 2).
- Auth / multi-tenancy.
- Migrating profile/resumes/cover letters/notifications to Supabase (stay in
  localStorage; the Apply flow keeps working unchanged).
- Audit-event dual-write to `audit_events` (stays in the local repository; the table
  exists and the write-through lands in a later round).
- Attachments / linked-items add flows (stay `DemoOnly`).

## 3. Single-user model (unchanged from v1 spec)

- Client never talks to Supabase directly; all reads/writes go through Next.js route
  handlers using the service-role client (`src/lib/supabase/admin.ts`).
- One owner user with the fixed UUID `00000000-0000-0000-0000-000000000001`
  (= `DEMO_USER_ID`, already stamped on every seed row). Created by inserting a
  minimal row into `auth.users` + `public.users` via SQL (the user never logs in this
  round; real auth later replaces this row's usage, not the schema).
- `getOwnerUserId()` helper (`src/lib/server/owner.ts`) is the single indirection
  point that later swaps to the session user.

## 4. Database

Project: existing Supabase project **saisai** (`zpfvdswiaiqoptfsafpd`), restored from
its paused state.

- **Migration 0001** — `docs/backend/supabase-bootstrap.sql` as-is.
- **Migration 0002** — `create unique index ... on public.application_activity (application_id)`
  so activity rows can be upserted one-per-application (the bootstrap only has a
  surrogate PK).
- No research/RBAC tables this round.

Row mapping (JSONB-first, per v1 design):

| Table | Key | Payload |
| --- | --- | --- |
| `applications` | `id` (= store `Application.id`) | full `Application` object |
| `application_activity` | `application_id` (unique) | full `Activity` object |
| `app_docs` | `(owner_user_id, application_id)` unique | full `AppDocs` object |

## 5. Data model changes

`Application` gains two optional fields:

- `companyName?: string` — display name for free-form companies. `company` remains the
  slug id (used for logos/urls); for manual entries it is `slugifyCompanyId(companyName)`.
  Display everywhere becomes `companyName ?? COMPANIES[company]?.name ?? toDisplayName(company)`
  via a shared `companyNameOf()` helper. `CompanyLogo` already falls back to derived
  initial/color for unknown ids — no change needed there.
- `postingUrl?: string` — makes "View original posting" a real link when present.

## 6. UI: manual entry & card editing

### New-application dialog

Replaces both hardcoded `createCard(status)` call sites (TopBar "New" button, board
column "+"). Fields: company name (required, free-form), role (required), location,
remote mode, salary min/max, status (pre-filled from the column that opened it),
priority, tags (comma-separated), posting URL, description. On submit: creates the
card via `createCard(input)`, navigates to the card, toasts. Zod-validated.

### Card detail dialog editing

- **Status**: status pill becomes a select over `STATUSES` → `moveStatus`.
- **Priority**: pill click cycles high → med → low → `updateApp`.
- **Location**: inline-editable in the company line (same pattern as the role title).
- **Description**: "About the role" gains an edit toggle (textarea) → `updateApp`.
- **Side panel**: Company, Level, Team, Mode, Salary min/max, Equity become editable
  rows (click to edit, blur/Enter to commit). Editing Company updates both
  `companyName` and the `company` slug.
- **Archive** (header button, currently demo): real — sets `archivedAt`, removes the
  card from the board and Jobs table, records history + audit. Archived cards remain
  reachable by direct URL; un-archive button shown on the card when archived.
- **Delete** (replaces the demo "More actions" button): real, with a confirm step —
  sets `deletedAt`; the card disappears everywhere.
- Board/Jobs list filters exclude `archivedAt`/`deletedAt` rows.
- Remaining demo: Watch / Star / Share, column header actions, attachment/link adds.

## 7. Persistence architecture (write-through adapter, per v1 spec)

- **Hydration**: `useHydration()` gains a server step when the adapter flag is
  `supabase`: `GET /api/apps` → if the server board is empty and local has cards,
  `POST /api/apps/import` (one-time carry-over of the current local/demo board);
  otherwise replace store state with server data. Only then is `hydrated` true.
- **Write-through**: every store mutation (`createCard`, `updateApp`, `moveStatus`,
  `reorderInStatus`, `addComment`, `addToWishlist`, `applyCard`, `archiveApp`,
  `deleteApp`) applies locally first, then queues a per-application debounced (400 ms)
  `PUT /api/apps` with the app's current `{application, activity, docs}` bundle.
  Retry once; on persistent failure toast "Saved locally only — sync failed".
- **Reset** (existing demo reset): clears the owner's DB rows (`DELETE /api/apps`),
  reseeds locally, re-imports.
- localStorage persist stays on as offline cache; with the adapter flag `local`
  everything behaves exactly as today (kill switch).

## 8. API routes (all service-role, owner-pinned, zod-validated)

- `GET  /api/apps` → `{ applications, activity, appDocs }`
- `PUT  /api/apps` → body `{ bundles: [{ application, activity?, docs? }] }` upserts
- `POST /api/apps/import` → full-state bulk import (only when server board is empty)
- `DELETE /api/apps` → clears all owner rows (used by reset)

## 9. Error handling

- Route failures return typed JSON errors; 503 when Supabase is unreachable.
- Hydration failure → keep local data, warning toast ("offline — showing local data").
- Write-through failure → local state kept, toast, no crash. Audit/history unaffected.

## 10. Configuration

```
NEXT_PUBLIC_SUPABASE_URL=…
NEXT_PUBLIC_SUPABASE_ANON_KEY=…
SUPABASE_SERVICE_ROLE_KEY=…            # server-only
NEXT_PUBLIC_PERSISTENCE_ADAPTER=supabase
```

Same values set in Vercel. `NEXT_PUBLIC_PERSISTENCE_ADAPTER=local` remains the
fallback demo mode and must keep working (CI runs in it).

## 11. Testing

- **Vitest**: `slugifyCompanyId`/`companyNameOf`; `createCard(input)`;
  `archiveApp`/`deleteApp` filtering; apps repository row mapping (mocked Supabase
  client); sync module (mocked fetch, fake timers for debounce).
- **Playwright**: persistence smoke (create app via dialog → clear localStorage →
  reload → card still there), skipped automatically when Supabase env is absent.
- Existing suites keep passing with adapter `local`.
