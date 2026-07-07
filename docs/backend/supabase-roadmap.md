# Supabase migration roadmap

JobTracker v1 ships with a single in-process adapter (`src/lib/repositories/`) that stores everything in localStorage via Zustand `persist`. This document captures the contract that the future Supabase adapter must honour and the milestones to swap implementations without rewriting UI.

## Current adapter contract

Defined in `src/lib/repositories/types.ts` and `src/lib/repositories/index.ts`:

- `eventLog: EventLogRepository` — singleton, exported from `src/lib/repositories`.
- The Zustand stores (`apps-store`, `profile-store`, `notifications-store`) own domain state and call `recordAudit(...)` (`src/lib/store/audit.ts`) for every side-effect.
- `redactMetadata` strips `token`, `apiKey`, `rawFile`, `resumeText`, `coverLetterText` before audit/log persistence. Any new repository implementation must keep this guarantee.

### Default selection

```env
# .env.local (optional in v1)
NEXT_PUBLIC_PERSISTENCE_ADAPTER=local
```

The adapter resolves at module load. Switching to `supabase` will require a build-time check that the Supabase env vars are present (see below) and a fallback to `local` with a warning if they are missing.

## Proposed Supabase tables

| Table | Owner | Notes |
| --- | --- | --- |
| `users` | RLS = `auth.uid()` | One row per Supabase auth user. `id uuid PK`. |
| `applications` | RLS = `owner_user_id = auth.uid()` | Mirrors `Application` type (UUID PK + `display_id` text unique-per-owner). |
| `application_activity` | same | `comments`, `history`, `links`, `attachments` denormalised into one JSONB column or split into 4 child tables (decide at schema cut). |
| `app_docs` | same | Stores resume/cover linkage + ATS result. |
| `profiles` | same | One row per user; matches `Profile` type. |
| `resumes`, `cover_letters` | same | One row each, soft-delete via `deleted_at`. |
| `notifications` | same | Append-only; `notification_state` table holds `read_at`/`dismissed_at`. |
| `audit_events` | RLS = read own, write any (server) | Matches `AuditEvent` type. Append-only, indexed on `(owner_user_id, created_at desc)`. |
| `app_logs` | service role only | Keep server-side; never read from the client. |

## Row-level security shape

All user-owned tables follow the same policy:

```sql
create policy "owner can read"
  on applications for select
  using (owner_user_id = auth.uid());

create policy "owner can write"
  on applications for insert with check (owner_user_id = auth.uid())
  for update using (owner_user_id = auth.uid())
  for delete using (owner_user_id = auth.uid());
```

`audit_events` writes go through a `security definer` function so the client cannot fabricate events for other users.

## Auth posture

- Supabase Email + Magic Link to start. No passwords stored client-side.
- The `DEMO_USER_ID` constant (`src/lib/types.ts`) becomes the live `auth.uid()` once auth is wired.
- A `<RequireAuth>` server component gates protected routes; unauthenticated visitors land on a marketing page (out of scope for v1).

## Migration milestones

1. **Schema** — provision tables + RLS in a Supabase project. Generate types via `supabase gen types typescript`. Land `src/lib/repositories/supabase/*` factories that satisfy the existing contract.
2. **Read path** — when `NEXT_PUBLIC_PERSISTENCE_ADAPTER=supabase`, hydrate Zustand stores from Supabase on first render. Keep localStorage as a write-through cache for offline reads.
3. **Write path** — store actions write to Supabase first, then mirror into Zustand. Conflict resolution: server `updated_at` wins.
4. **Logging** — `recordAudit` and `eventLog.appendLog` start dual-writing to Supabase. Server-side audit retention + dashboards live in Supabase.
5. **Auth** — replace `DEMO_USER_ID` with `auth.uid()`. Add `/login`. Gate every page in `app/`.

Each milestone is independently shippable; the local adapter remains a working fallback throughout.
