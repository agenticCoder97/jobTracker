# Create fix, clean slate, real card tabs + documents — design

- **Date**: 2026-07-06
- **Status**: Approved
- **Follows**: `2026-07-06-home-board-supabase-design.md` (Round 1, shipped). Match tab and
  live discovery APIs remain deferred to Round 3 per
  `2026-07-06-real-data-single-user-design.md`.
- **Scope**: Fix the production "Create application" failure, start the deployed app with an
  empty board (mock data stays for local dev), make the card-detail Activity / Attachments /
  Linked / History tabs real, and make resume/cover-letter upload real with linking into card
  attachments. Single user, no auth (unchanged).

## 1. Goals

1. Creating an application works in the deployed production app.
2. The deployed app starts with a clean board — no seed/mock cards in the DB or UI. Local
   dev (`NEXT_PUBLIC_PERSISTENCE_ADAPTER` unset or `local`) keeps the full demo board.
3. Card detail tabs Activity, Attachments, Linked, and History are fully functional
   (Match stays as-is: renders when ATS docs exist, deferred otherwise).
4. Resume/cover-letter upload on the Profile page stores real files; the document library
   syncs to Supabase; uploaded documents can be linked into any card's Attachments tab.

## 2. Non-goals (this round)

- Match tab scoring for cards without applied docs (Round 3).
- Jobs / Companies / Research / Notifications real data — they keep labeled demo data.
- Auth / multi-tenancy.

## 3. Bug fix: Create application submit (production)

The e2e smoke created a card through `NewApplicationDialog` locally today, so the failure is
production-specific. Reproduce against a local production build (`pnpm build && pnpm start`)
with the adapter unset and with `supabase`, via browser automation, then fix the root cause.
No fix is written before the reproduction demonstrates the failure.

**Related latent bug, fixed in the same pass:** new cards take
`seedUuid(displayId)`, which hashes unknown labels by *summing character codes* —
`JT-43` and `JT-52` collide to the same UUID, so a later card can silently overwrite an
earlier one (locally and via DB upsert on `id`). New cards (createCard, addToWishlist) use
`crypto.randomUUID()`; seeded demo cards keep their deterministic IDs.

## 4. Clean slate in deployed mode, mock kept locally

The adapter flag is the switch (same kill switch as Round 1):

- **Seed gating**: the apps store's initial state is empty when
  `NEXT_PUBLIC_PERSISTENCE_ADAPTER === 'supabase'`; otherwise it is `seedAll()` as today.
  Same gating for the profile store's seeded resumes/cover letters (see §6).
- **First-run auto-import is removed** (`hydrateFromServer` import branch +
  `/api/apps/import` usage): with a clean DB it would only re-upload localStorage seed
  data. Empty server ⇒ empty board. `resetServer` no longer re-imports either.
- **Reset semantics**: in supabase mode, Reset clears the owner's DB rows and leaves an
  empty board. In local mode it reseeds the demo, as today.
- **DB cleanup (operational)**: delete the 3 test rows currently in `applications` (+ their
  `application_activity` / `app_docs` rows): JT-43, JT-44 "Persistence Test Co", JT-45.
- **Vercel env (operational)**: set `NEXT_PUBLIC_PERSISTENCE_ADAPTER=supabase` on
  **Production only**. Preview deploys stay in demo mode so they never write to the real DB.
- **Local dev**: `.env.local` sets `NEXT_PUBLIC_PERSISTENCE_ADAPTER=local` so local runs
  show the mock board; flip to `supabase` manually to test real sync.

Stale-browser note: deployed browsers holding persisted seed data in localStorage get
replaced by server state on hydration (already the behaviour); with the import path gone
they can no longer pollute the DB. The offline fallback (show local cache + warning toast)
is unchanged.

## 5. Card detail tabs

### Activity
Comments already work through `addComment` + write-through. Verify the round-trip in
supabase mode (comment → PUT → reload → present); fix if broken. Attach/mention/emoji
buttons stay `DemoOnly`.

### Attachments (real)
- **UI**: upload button + drag-drop zone on the tab; each attachment row gets a download
  action and a remove action. Plus "Link document" (see §6).
- **Storage, supabase mode**: new private Supabase Storage bucket `jobtracker-files`
  (paths: `attachments/<applicationId>/…`, `documents/resumes/…`,
  `documents/cover-letters/…`). Files upload through a
  server route using the service-role client; downloads go through a short-lived signed-URL
  route; removal deletes the object and the metadata. Cap 10 MB/file.
- **Storage, local mode**: file stored as a data URL inside the attachment record
  (localStorage), cap 2 MB/file so the demo remains self-contained.
- **Metadata**: stays in `activity.attachments` (already synced by write-through).
  `Attachment` gains optional `storagePath`, `dataUrl`, `source: 'upload' | 'resume' |
  'cover-letter'`, and a real byte size; `kind` derived from the file extension/MIME.
- History records "Attachment added" / "Attachment removed".

### Linked (real)
"Add link" form (title + URL, type select defaulting to `link`). Rows open the URL in a new
tab and can be removed. Stored in `activity.links` (already synced). History records
"Link added" / "Link removed".

### History
Already records created / status / field / comment events and renders. Fill the gaps:
archive/unarchive and delete already log; add attachment and link events per above. Verify
tab counts in `TabBar` stay correct.

### Overview / Match
Overview is already editable (title, description, location, side panel) — verified as part
of the same pass, no new work planned. Match renders ATS data when an application has
applied docs and keeps its empty state otherwise; scoring improvements deferred.

## 6. Documents: real upload + Supabase sync + card linking

- **Upload (Profile page)**: the `DemoOnly` "Upload" buttons become real file inputs
  (PDF/DOC/DOCX). Files use the same storage mechanism as attachments (bucket in supabase
  mode, data URL in local mode). Upload fills real `name`/`size`; `flavor`, `keywords`,
  `summary` remain user-editable metadata. `Resume`/`CoverLetter` gain optional
  `storagePath`/`dataUrl`.
- **Library sync**: resumes and cover letters write-through to the existing `resumes` and
  `cover_letters` tables using the board's JSONB pattern (payload row per document, owner
  pinned server-side), with server hydration on load — mirroring `apps-sync`. Seeded demo
  documents appear only in local mode; supabase mode starts with an empty library.
- **Link to a card (Attachments tab)**: "Link document" opens a picker listing the library.
  Picking one appends an attachment row referencing the same stored file
  (`source: 'resume' | 'cover-letter'`, plus the doc id and storage path/data URL) — no
  re-upload. Removing a linked row only unlinks from the card; the library copy is
  untouched. History records "Resume linked" / "Cover letter linked".
- The Apply flow (`applyCard`, `appDocs`, ATS) is unchanged.

## 7. Error handling

- Upload failures (network, size cap, bucket error): toast with the reason; no metadata
  row is written. Oversized local-mode files are rejected before reading.
- Signed-URL/download failures: toast; row remains.
- Document-library sync failures follow the board pattern: optimistic local state, one
  retry, then "saved locally only" toast.
- All new server routes return typed JSON errors (400 invalid body, 501 adapter disabled,
  503 upstream), matching `/api/apps`.

## 8. Configuration

- Vercel Production: `NEXT_PUBLIC_PERSISTENCE_ADAPTER=supabase` (new). Preview/Development
  environments: unset (demo mode).
- `.env.local`: `NEXT_PUBLIC_PERSISTENCE_ADAPTER=local` by default.
- New Supabase Storage bucket for attachments + documents (private; service-role access
  only), created operationally alongside the DB cleanup.

## 9. Testing

- **Vitest**: UUID generation for new cards (uniqueness, non-collision), seed gating by
  adapter flag, attachment/link store actions (+ history events), attachment upload/signed
  URL/delete route handlers and the documents repository with a mocked Supabase client
  (existing repository-test style), document-linking picker behaviour.
- **Playwright**: supabase-mode smoke — empty first-run board, create a card, reload,
  card survives; attachment upload happy path. Existing suites keep passing in local mode.
- **Manual/automated verification** on the production deploy after merge: create a card in
  the deployed app, reload, confirm persistence and clean board baseline.

## 10. Rollout

Feature branch `feature/create-fix-clean-slate-real-tabs` off `Development`; PR into
`Development`, then merge to `Production` per the existing flow. Operational steps (DB row
cleanup, bucket creation, Vercel env var) happen alongside the code merge; env var lands
before the production deploy so the first clean-slate deploy hydrates from the (cleaned)
DB.
