# JobTracker — Plan 2: Jobs + Companies + Apply flow

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax. Each task maps 1:1 to a Linear issue. **Prerequisite:** Plan 1 fully merged to `Development`.

**Goal:** Add the three remaining "discoverable jobs" surfaces — the Jobs table, the Companies grid + Company Detail modal, and the Resume Picker (Apply) flow — so the user can browse roles outside their pipeline, see company context, and submit applications with a chosen resume + cover letter.

**Architecture:** Extends Plan 1's repository + store pattern. New URL-canonical state for Jobs filters (`scope`, `q`, `status`, `mode`) read directly from `useSearchParams()` per spec §6. New parallel + intercepting routes for `/listing/[displayId]`, `/apply/[displayId]`, `/company/[companyId]` (the last already scaffolded in Plan 1's intercepting matrix — Plan 2 fills in the dialog).

**Tech Stack:** No new top-level dependencies. Uses existing Radix Select, Radix RadioGroup, Radix Checkbox, react-hook-form + zod (already installed Plan 1).

**Spec:** `docs/superpowers/specs/2026-05-08-jobtracker-design.md` — §8.11 Resume Picker, §8.12 Jobs (incl. §8.12.1 Job Listing Preview), §8.13 Companies, §8.14 Company Detail.

**Style note:** Same convention as Plan 1 — file path, intent, verifiable outcome. Code only when the choice isn't obvious.

**Linear/GitHub workflow:** Identical to Plan 1's "Per-task workflow" section. Branch from `Development`. Issue label: `plan-2-jobs-companies-apply`.

---

## Phase A — URL-canonical state hooks (Tasks 1–2)

Reference: spec §6 "Canonical-state authority".

### Task 1: Jobs URL params hook

**Files:** `src/lib/url-params/use-jobs-params.ts`, `tests/unit/url-params/use-jobs-params.test.ts`.

- [ ] **Step 1:** Hook reads `useSearchParams()` for `scope`, `q`, `status`, `mode`. Returns `{ scope: 'all'|'tracked'|'matched'|'open', q: string, statusFilter: StatusId | 'open' | 'all', remoteFilter: RemoteMode | 'all' }` with sensible defaults when params missing.
- [ ] **Step 2:** Returns a `setParams(patch)` function that calls `router.replace(\`/jobs?\${buildQs(merged)}\`)` so URL is the source of truth. Empty/default values omitted from URL.
- [ ] **Step 3:** Test: missing params → defaults; setting `q='stripe'` writes `?q=stripe`; clearing returns to bare `/jobs`.
- [ ] **Step 4:** Commit `feat(url-params): jobs filter hook`.

### Task 2: Profile tab URL param hook

**Files:** `src/lib/url-params/use-profile-tab.ts`, `tests/unit/url-params/use-profile-tab.test.ts`.

- [ ] **Step 1:** Hook reads `tab` param; returns `'overview'|'resumes'|'covers'|'preferences'|'activity'` with `'overview'` default. `setTab(next)` calls `router.replace(\`/profile?tab=\${next}\`)` (omits `?tab=overview`).
- [ ] **Step 2:** Test: default + transitions.
- [ ] **Step 3:** Commit `feat(url-params): profile tab hook`.

---

## Phase B — Jobs view (Tasks 3–7)

Reference: spec §8.12.

### Task 3: JobsHeader

**Files:** `src/components/jobs/JobsHeader.tsx`.

- [ ] **Step 1:** h1 "Jobs" + crumbs "Workspace / Jobs" + counter `<b>X</b> of <b>Y</b> jobs` (X = current filtered, Y = total tracked + listings).
- [ ] **Step 2:** Commit `feat(jobs): JobsHeader`.

### Task 4: JobsFilterBar

**Files:** `src/components/jobs/JobsFilterBar.tsx`, `tests/unit/components/jobs/JobsFilterBar.test.tsx`.

- [ ] **Step 1:** Search input (max-width 320, placeholder per spec). On change → `useJobsParams().setParams({ q: value })`. Debounced 200ms.
- [ ] **Step 2:** Vertical divider, then 4 scope chips (All / On my board / Matched for me / Open positions) with counts. Active chip → gold tint. Click → `setParams({ scope: id })`.
- [ ] **Step 3:** Vertical divider, Status `<Select>` (Radix) with options All + each STATUS title + "Open / not tracked". Mode `<Select>` with All / Remote / Hybrid / Onsite.
- [ ] **Step 4:** All filters serialize to URL, never to a store.
- [ ] **Step 5:** Test: changing each filter writes to URL; clearing all returns to bare `/jobs`.
- [ ] **Step 6:** Commit `feat(jobs): FilterBar with URL params`.

### Task 5: JobsTable + row click logic

**Files:** `src/components/jobs/JobsTable.tsx`, `src/components/jobs/use-jobs-rows.ts`, `tests/unit/components/jobs/use-jobs-rows.test.ts`.

- [ ] **Step 1:** `useJobsRows(params)` hook combines tracked applications + untracked job listings into a unified row set. Tracked rows carry `kind: 'tracked'`; untracked carry `kind: 'listing'`. Apply scope/q/status/mode filters per spec §8.12.
- [ ] **Step 2:** `JobsTable` renders 7 columns per spec §8.12 Table (Job / Status / Location / Salary / Match / Updated / Action). Row chrome per spec.
- [ ] **Step 3:** Row click handlers (finding #10):
  - Tracked → `<Link href="/card/<displayId>">`.
  - Untracked → `<Link href="/listing/<displayId>">` (preview modal, NOT auto-add).
- [ ] **Step 4:** Action cell:
  - Tracked → "Track" muted button → also navigates to card modal.
  - Untracked → "Wishlist" gold button → calls `useAppsStore.addToWishlist(listing)` + fires success toast + navigates to the new card's `/card/<displayId>`.
- [ ] **Step 5:** Empty state per spec.
- [ ] **Step 6:** Test: filter combinations produce expected row counts; row click navigates correctly per kind; "Wishlist" button creates a card and navigates.
- [ ] **Step 7:** Commit `feat(jobs): JobsTable + row hook`.

### Task 6: JobsView page

**Files:** `src/app/jobs/page.tsx` (replace placeholder).

- [ ] **Step 1:** Client component renders `<JobsHeader /> + <JobsFilterBar /> + <JobsTable />`. Reads URL params via the hook from Task 1.
- [ ] **Step 2:** Verify: `/jobs?scope=matched` deep-link from Research (placeholder URL test for now — Research lands in Plan 3) renders with the matched chip pre-selected.
- [ ] **Step 3:** Commit `feat(jobs): JobsView page`.

### Task 7: Job Listing Preview modal

**Files:** `src/components/jobs/JobListingPreviewDialog.tsx`, `src/app/listing/[displayId]/page.tsx`, `src/app/@modal/(.)listing/[displayId]/page.tsx`, `src/app/@modal/(..)jobs/(.)listing/[displayId]/page.tsx`, `src/app/@modal/(..)companies/(.)listing/[displayId]/page.tsx`, `src/app/@modal/(..)research/(.)listing/[displayId]/page.tsx`, `src/app/@modal/(..)profile/(.)listing/[displayId]/page.tsx`.

- [ ] **Step 1:** `JobListingPreviewDialog({ displayId })` per spec §8.12.1. Resolves listing via `seedAll()` (or a future repository call). Renders Dialog with: head crumbs, body (64px logo + role h1 + company link + location + salary + tags + match chip + posted/applicants line), footer ("Open original" demo-only link + "Add to wishlist" gold button).
- [ ] **Step 2:** "Add to wishlist" → `addToWishlist(listing)` + toast + `router.replace('/card/<newDisplayId>')` so user lands on freshly-created card.
- [ ] **Step 3:** Canonical full-route page renders `<JobsView />` underneath + the dialog.
- [ ] **Step 4:** Intercepting routes for each top-level view (Board/Jobs/Companies/Research/Profile) — same pattern as card/company in Plan 1.
- [ ] **Step 5:** E2E smoke (`tests/e2e/jobs-listing.spec.ts`): goto `/jobs?scope=open`, click an untracked row, dialog appears with no state mutation. Click "Add to wishlist", redirected to `/card/<displayId>`, board now has the new card.
- [ ] **Step 6:** Commit `feat(jobs): JobListingPreviewDialog + intercepting routes`.

---

## Phase C — Companies (Tasks 8–11)

Reference: spec §8.13.

### Task 8: CompaniesFilterBar

**Files:** `src/components/companies/CompaniesFilterBar.tsx`.

- [ ] **Step 1:** Search input (max-width 360) wired to `useUiStore.companiesSearch`. 4 sort chips per spec (Top rated / Most open roles / Highest comp / A–Z) → `useUiStore.companiesSort`. Active chip → gold tint.
- [ ] **Step 2:** Companies search/sort intentionally NOT URL-canonical (workspace-private per spec §6).
- [ ] **Step 3:** Commit `feat(companies): FilterBar`.

### Task 9: CompanyCard

**Files:** `src/components/companies/CompanyCard.tsx`.

- [ ] **Step 1:** Renders all chrome per spec §8.13 CompanyCard subsection: top row (44px logo + name + industry/HQ + Glassdoor block with "(demo)" caption), 3 stat rows, tag row (with "X on board" pill if `appsHere > 0`), action row ("X open roles" gold pill + "Site" + bookmark — last two wrapped in `<DemoOnly>`).
- [ ] **Step 2:** Whole-card click → `<Link href="/company/<companyId>">`. Action button click also navigates (uses `e.stopPropagation()` for nested handlers).
- [ ] **Step 3:** Commit `feat(companies): CompanyCard`.

### Task 10: CompaniesView page

**Files:** `src/app/companies/page.tsx` (replace placeholder), `src/components/companies/CompaniesView.tsx`, `src/components/companies/use-sorted-companies.ts`.

- [ ] **Step 1:** `useSortedCompanies()` reads from seed `COMPANY_DETAILS + COMPANIES`, joins `appsHere = applications.filter(a => a.company === id).length`, applies search + sort from `useUiStore`.
- [ ] **Step 2:** `CompaniesView` renders TitleRow + CompaniesFilterBar + 3-col responsive grid of CompanyCard.
- [ ] **Step 3:** Smoke: `pnpm dev` → `/companies` shows ~20 cards.
- [ ] **Step 4:** Commit `feat(companies): CompaniesView page`.

### Task 11: CompanyDetailDialog + intercepting routes

**Files:** `src/components/company-detail/{CompanyDetailDialog,CompanyHero,KpiGrid,OpenRolesSection,PipelineSection,ReviewsSection}.tsx`, `src/app/company/[companyId]/page.tsx` (canonical), and the 5 intercepting copies under `@modal/`.

- [ ] **Step 1:** `CompanyDetailDialog({ companyId })` per spec §8.14. Composes hero (64px logo + meta line + tags + "Follow" demo-only) + 4 KPI cards (each with "Demo data" caption per finding #12) + Open roles section (list of listings filtered by company, each with "Wishlist" gold button → addToWishlist) + Pipeline section (user's apps at this company, click → `/card/<displayId>`) + Reviews section (mock reviews, header carries "Demo data — not from a real review source" caption).
- [ ] **Step 2:** Star/External-link header buttons wrapped in `<DemoOnly>`.
- [ ] **Step 3:** Canonical `/company/[companyId]/page.tsx` renders `<CompaniesView />` underneath + dialog.
- [ ] **Step 4:** Intercepting copies for Board/Jobs/Companies/Research/Profile (same pattern as Plan 1's card-detail matrix).
- [ ] **Step 5:** E2E smoke (`tests/e2e/company-detail.spec.ts`): goto `/companies`, click Stripe, dialog appears, hero+KPIs render, click an open role's Wishlist button, board now has it.
- [ ] **Step 6:** Commit `feat(company-detail): CompanyDetailDialog + intercepting routes`.

---

## Phase D — Resume Picker (Apply) flow (Tasks 12–14)

Reference: spec §8.11.

### Task 12: ResumePickerDialog

**Files:** `src/components/apply/ResumePickerDialog.tsx`, `tests/unit/components/apply/ResumePickerDialog.test.tsx`.

- [ ] **Step 1:** Dialog (max-width 720px) per spec §8.11. Head crumbs `[rocket_launch] Apply to <Company> · <Role>` + Close.
- [ ] **Step 2:** Body:
  - Muted intro line (verbatim spec copy).
  - "Choose a resume" uppercase header + Radix RadioGroup of all resumes. Each option = radio dot + name + flavor + page count chip. Selected → gold border + gold-tint bg. Initial value = `appDocs[id]?.resumeId ?? <default resume>`.
  - "Cover letter" header + "Include" Checkbox (default checked). When checked, Radix RadioGroup of cover letters; default = `appDocs[id]?.coverLetterId ?? <default cover>`.
- [ ] **Step 3:** Footer right-aligned: Cancel (closes via `router.back`) + "Submit application" gold pill (rocket icon).
- [ ] **Step 4:** Submit calls `useAppsStore.applyCard(applicationId, { resumeId, coverLetterId: includeCover ? coverId : null })`, fires toast "Marked as applied · moved to Applied column", `router.replace('/card/<displayId>')` so user sees the now-applied card detail.
- [ ] **Step 5:** Form managed via react-hook-form + zod schema (resumeId: string required UUID, coverLetterId: string nullable). Submit button disabled while invalid.
- [ ] **Step 6:** Test: render with seed wishlist card, default resume + cover pre-selected; toggling Include hides the cover RadioGroup; submit calls `applyCard` with correct payload.
- [ ] **Step 7:** Commit `feat(apply): ResumePickerDialog`.

### Task 13: Apply route + intercepting routes

**Files:** `src/app/apply/[displayId]/page.tsx` (replace Plan 1 placeholder), `src/app/@modal/(.)apply/[displayId]/page.tsx`, `src/app/@modal/(..)jobs/(.)apply/[displayId]/page.tsx`, `src/app/@modal/(..)companies/(.)apply/[displayId]/page.tsx`, `src/app/@modal/(..)research/(.)apply/[displayId]/page.tsx`, `src/app/@modal/(..)profile/(.)apply/[displayId]/page.tsx`.

- [ ] **Step 1:** Canonical `/apply/[displayId]/page.tsx` renders `<BoardView />` + `<ResumePickerDialog displayId={params.displayId} />`.
- [ ] **Step 2:** 5 intercepting copies render the dialog only.
- [ ] **Step 3:** Verify: from board, click "Apply now" on a wishlist card → URL is `/apply/<displayId>` → dialog renders over board.
- [ ] **Step 4:** Commit `feat(apply): canonical + intercepting routes`.

### Task 14: Wire entry points to Apply

**Files:** `src/components/board/ApplicationCard.tsx` (already wired in Plan 1), `src/components/card-detail/CardHeader.tsx` (already wired in Plan 1), `src/components/jobs/JobsTable.tsx`.

- [ ] **Step 1:** Confirm the wishlist "Apply now" CTA on ApplicationCard navigates to `/apply/<displayId>` (was wired in Plan 1; verify functional now that dialog exists).
- [ ] **Step 2:** Confirm Card Detail header's "Apply now" pill (visible when status is wishlist) navigates to `/apply/<displayId>`.
- [ ] **Step 3:** Optional: from Jobs table tracked-row in wishlist status, the Action cell shows "Apply now" instead of "Track" (small enhancement to Plan 1's logic).
- [ ] **Step 4:** Commit `feat(apply): wire entry points`.

---

## Phase E — Wire-up + verification (Tasks 15–17)

### Task 15: Cross-view navigation polish

**Files:** any component referencing companies (Board ApplicationCard, Card Detail Side Panel RoleGroup, Jobs row, Research picks, Profile experience — Research/Profile Plan 3).

- [ ] **Step 1:** Confirm every `companyId` reference in Plan 1 + Plan 2 components is wrapped in a `<Link href="/company/<companyId>">` so clicking opens the company detail modal regardless of source view.
- [ ] **Step 2:** Manual smoke: from Board card → click company name → company detail opens. From Card Detail side panel → click company name → company detail opens. From Jobs table → click company → company detail opens.
- [ ] **Step 3:** Commit `feat: wire all company links to detail modal`.

### Task 16: Plan 2 E2E suite expansion

**Files:** `tests/e2e/jobs-flow.spec.ts`, `tests/e2e/companies-flow.spec.ts`, `tests/e2e/apply-flow.spec.ts`.

- [ ] **Step 1:** `jobs-flow.spec.ts`:
  - Filter by scope=matched, status=All, q='stripe' → URL serializes; rows narrow.
  - Click an untracked row → preview dialog opens, no card created.
  - Click "Add to wishlist" inside dialog → redirected to `/card/<id>`, board has new card.
- [ ] **Step 2:** `companies-flow.spec.ts`:
  - Search "stripe" → 1 card visible.
  - Click company → detail opens, KPIs render, "Demo data" caption visible.
  - Click an Open role → board has new wishlist card.
- [ ] **Step 3:** `apply-flow.spec.ts`:
  - From board, click "Apply now" on a wishlist card.
  - Picker dialog opens. Select non-default resume. Toggle off cover letter. Submit.
  - Card now in Applied column. `appDocs[id].coverLetterId === null`. `appDocs[id].resumeId === <selected>`. Resume's `timesUsed` incremented by 1.
- [ ] **Step 4:** Run `pnpm test:e2e` — all pass.
- [ ] **Step 5:** Commit `test: Plan 2 E2E flows`.

### Task 17: Verify + handoff to Plan 3

**Files:** none.

- [ ] **Step 1:** `pnpm lint && pnpm typecheck && pnpm test:unit && pnpm test:e2e && pnpm build` all clean.
- [ ] **Step 2:** Manual walkthrough:
  - Browse all 3 newly-functional views (Jobs, Companies — Research/Profile still placeholders).
  - Apply to a wishlist card end-to-end.
  - Refresh on `/listing/JL-101` (deep link) — preview modal still opens.
  - Refresh on `/company/stripe` — detail modal still opens.
  - Refresh on `/apply/JT-42` — picker still opens.
- [ ] **Step 3:** Commit `chore: Plan 2 verification checkpoint`.

---

## What Plan 2 ships

After all 17 tasks merge:

- Jobs view fully functional with URL-canonical filters.
- Job Listing Preview modal for untracked rows (no silent state mutation).
- Companies grid with search + 4 sort modes.
- Company Detail modal with hero + KPIs + Open roles + Pipeline + Reviews (all marked demo-data where applicable).
- Resume Picker modal for the Apply flow, end-to-end Wishlist → Applied with linked docs + ATS-ready `appDocs[id]` entry.
- All 5 top-level views now have intercepting routes for `/card`, `/company`, `/listing`, `/apply` modals.
- Profile + Research are still placeholders — addressed in Plan 3.

---

## Spec coverage check (Plan 2)

| Spec § | Plan 2 coverage |
| --- | --- |
| 8.11 Resume Picker | Tasks 12–14. |
| 8.12 Jobs | Tasks 3–6. |
| 8.12.1 Job Listing Preview | Task 7. |
| 8.13 Companies | Tasks 8–10. |
| 8.14 Company Detail | Task 11. |
| §6 URL-canonical state for Jobs | Task 1. |
| §6 URL-canonical state for Profile tab | Task 2 (used by Plan 3). |
| §8.17 Demo-only labels for Site/bookmark/Follow/Open original/Star | Applied throughout Tasks 9, 11, 7. |
| Finding #10 (untracked row click) | Task 5 step 3 — Task 7 dialog. |
| Finding #12 (demo data labels) | Task 9 (Glassdoor demo), Task 11 (KPI demo + Reviews demo). |
