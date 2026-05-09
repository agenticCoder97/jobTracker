# JobTracker — Plan 4: CI/CD + Tests + Polish

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax. Each task maps 1:1 to a Linear issue. **Prerequisite:** Plans 1, 2, and 3 fully merged to `Development`.

**Goal:** Harden the app for branch-based delivery: GitHub Actions, full Playwright coverage, demo-data labeling, audit/log plumbing, accessibility pass, and deployment handoff.

**Architecture:** Keeps local-first runtime as the default. Adds CI and test coverage without requiring Supabase. Introduces adapter-gated audit/app logging shapes so later Supabase migrations can persist the same events without rewriting UI components.

**Tech Stack:** Existing Next.js 15, TypeScript strict, Vitest + RTL, Playwright Chromium, ESLint + Prettier, GitHub Actions, Vercel Git integration, Zustand persist.

**Spec:** `docs/superpowers/specs/2026-05-08-jobtracker-design.md` — §11.5 Supabase/logging roadmap, §13 Accessibility, §14 Testing, §15 CI/CD + branching + deploy, §8.17 Demo-only controls.

---

## Phase A — CI/CD Foundation (Tasks 1–4)

### Task 1: GitHub Actions quality workflow

**Files:** `.github/workflows/ci.yml`.

- [ ] **Step 1:** Add workflow `CI` triggered on pull requests to `Development`, `Production`, `Patch`, and `main`.
- [ ] **Step 2:** Use `actions/checkout@v4`, `pnpm/action-setup@v4` with the repo package manager version, `actions/setup-node@v4` with Node 22 and pnpm cache.
- [ ] **Step 3:** Run `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm typecheck`, `pnpm test:unit`, and `pnpm build`.
- [ ] **Step 4:** Upload Vitest coverage artifacts when coverage is generated.
- [ ] **Step 5:** Commit `ci: add pull request quality workflow`.

### Task 2: GitHub Actions E2E workflow

**Files:** `.github/workflows/e2e.yml`.

- [ ] **Step 1:** Add workflow `E2E` triggered on pull requests to `Production`, workflow dispatch, and nightly cron at `17 9 * * 1-5`.
- [ ] **Step 2:** Install dependencies, run `pnpm exec playwright install --with-deps chromium`, then `pnpm test:e2e`.
- [ ] **Step 3:** Upload `playwright-report/` and `test-results/` on failure and success.
- [ ] **Step 4:** Commit `ci: add Playwright E2E workflow`.

### Task 3: Branching and deploy docs

**Files:** `README.md`, `docs/deployment/branching-and-vercel.md`.

- [ ] **Step 1:** Document branch roles: `main` initial scaffold/archive, `Development` integration previews, `Production` production deploys, `Patch` hotfixes.
- [ ] **Step 2:** Document Vercel settings: project connected to GitHub repo, Production Branch = `Production`, preview deploys for PRs, required env vars = none for local adapter.
- [ ] **Step 3:** Document local commands: `corepack pnpm dev`, `lint`, `typecheck`, `test:unit`, `test:e2e`, `build`.
- [ ] **Step 4:** Commit `docs: branch and Vercel deployment guide`.

### Task 4: Branch protection checklist

**Files:** `docs/deployment/github-branch-protection.md`.

- [ ] **Step 1:** Add exact recommended protections for `Development`: require PR, require `CI`, allow admins to bypass only for emergency recovery.
- [ ] **Step 2:** Add exact recommended protections for `Production`: require PR from `Development` or `Patch`, require `CI` and `E2E`, require linear history, restrict force-push.
- [ ] **Step 3:** Add `Patch` hotfix procedure: branch from `Production`, PR to `Production`, merge back to `Development`.
- [ ] **Step 4:** Commit `docs: branch protection checklist`.

---

## Phase B — Full E2E Coverage (Tasks 5–10)

### Task 5: Navigation and modal deep-link smoke

**Files:** `tests/e2e/navigation.spec.ts`.

- [ ] **Step 1:** Test topbar navigation between `/`, `/jobs`, `/companies`, `/research`, and `/profile`.
- [ ] **Step 2:** Test direct-load `/card/JT-34` renders board underlay plus card detail dialog.
- [ ] **Step 3:** Test direct-load `/company/stripe`, `/listing/JL-101`, and `/apply/JT-42` after Plan 2 routes exist.
- [ ] **Step 4:** Commit `test(e2e): navigation and modal deep links`.

### Task 6: Board drag/drop regression

**Files:** `tests/e2e/board-dnd.spec.ts`.

- [ ] **Step 1:** Drag a Wishlist card to Applied using Playwright pointer actions.
- [ ] **Step 2:** Assert the card appears in Applied, a status history row is created, and refresh preserves the status.
- [ ] **Step 3:** Drag within the same column and assert order persists after refresh.
- [ ] **Step 4:** Commit `test(e2e): board drag-drop persistence`.

### Task 7: Card detail regression suite

**Files:** `tests/e2e/card-detail-full.spec.ts`.

- [ ] **Step 1:** Open JT-34 and click all six tabs: Overview, Match, Activity, Attachments, Linked, History.
- [ ] **Step 2:** Add a comment, refresh `/card/JT-34`, and assert the comment persists.
- [ ] **Step 3:** Edit the card title, blur, refresh, and assert the edited title persists.
- [ ] **Step 4:** Click a DemoOnly header action and assert a toast appears and route does not change.
- [ ] **Step 5:** Commit `test(e2e): card detail full smoke`.

### Task 8: Jobs/Companies/Apply regression suite

**Files:** `tests/e2e/jobs-flow.spec.ts`, `tests/e2e/companies-flow.spec.ts`, `tests/e2e/apply-flow.spec.ts`.

- [ ] **Step 1:** Keep or expand the Plan 2 flow tests so they run in the full suite.
- [ ] **Step 2:** Add assertions that untracked job row clicks open preview without creating a card.
- [ ] **Step 3:** Add assertions that Apply increments resume usage and can omit cover letter.
- [ ] **Step 4:** Commit `test(e2e): jobs companies apply regressions`.

### Task 9: Research/Profile regression suite

**Files:** `tests/e2e/research-flow.spec.ts`, `tests/e2e/profile-flow.spec.ts`.

- [ ] **Step 1:** Keep or expand Plan 3 tests for Research add-to-wishlist and Profile About persistence.
- [ ] **Step 2:** Add reset demo data flow: mutate board and About, reset, assert seed data returns.
- [ ] **Step 3:** Add DemoOnly assertion for Research LinkedIn controls and Profile side card links.
- [ ] **Step 4:** Commit `test(e2e): research profile regressions`.

### Task 10: CI test sharding and stability

**Files:** `playwright.config.ts`, `.github/workflows/e2e.yml`.

- [ ] **Step 1:** Configure Playwright retries: `retries: process.env.CI ? 2 : 0`, `workers: process.env.CI ? 2 : undefined`.
- [ ] **Step 2:** Set `trace: 'on-first-retry'`, `screenshot: 'only-on-failure'`, and `video: 'retain-on-failure'`.
- [ ] **Step 3:** In CI, run E2E with `--reporter=html,line`.
- [ ] **Step 4:** Commit `test(e2e): stabilize CI Playwright settings`.

---

## Phase C — Demo-only and Demo-data Polish (Tasks 11–13)

### Task 11: Central DemoOnly wrapper audit

**Files:** `src/components/ui/DemoOnly.tsx`, all components listed in spec §8.17, `tests/unit/components/ui/DemoOnly.test.tsx`.

- [ ] **Step 1:** Ensure `<DemoOnly label>` wraps every canonical demo-only control listed in spec §8.17.
- [ ] **Step 2:** Wrapper adds `data-demo-only="true"`, Radix Tooltip text `"Demo only — coming in a future release."`, and info toast `"Demo only — '<label>' isn't wired up yet."`.
- [ ] **Step 3:** Test original child `onClick` is not called and no URL/state mutation occurs.
- [ ] **Step 4:** Commit `refactor(ui): centralize DemoOnly controls`.

### Task 12: Demo-data labeling pass

**Files:** company, research, LinkedIn, who-viewed, and market trend components.

- [ ] **Step 1:** Add visible "Demo data" or "Demo data — no integration in v1" captions wherever spec finding #12 requires it.
- [ ] **Step 2:** Add `data-demo-data="true"` attributes to those regions so E2E tests can assert labels exist.
- [ ] **Step 3:** E2E assertion: `/research` LinkedIn section and `/company/stripe` KPI/reviews sections show demo-data captions.
- [ ] **Step 4:** Commit `style: label demo-data surfaces`.

### Task 13: Empty/loading/error state polish

**Files:** shared empty state component, Jobs, Companies, Research, Profile, modal not-found routes.

- [ ] **Step 1:** Ensure every table/grid/list section has a user-facing empty state with icon, title, optional description, and functional reset/clear action when applicable.
- [ ] **Step 2:** Add not-found states for missing card/listing/company/apply/profile data with a Close or Back to board action.
- [ ] **Step 3:** Add unit tests for missing displayId/companyId routes.
- [ ] **Step 4:** Commit `fix(ui): complete empty and not-found states`.

---

## Phase D — Audit and Logging Plumbing (Tasks 14–17)

### Task 14: Repository event log interface

**Files:** `src/lib/repositories/types.ts`, `src/lib/repositories/local/event-log-repository.ts`, `src/lib/repositories/index.ts`, `tests/unit/repositories/event-log-repository.test.ts`.

- [ ] **Step 1:** Define `AuditEvent` and `AppLog` types from spec §11.5.
- [ ] **Step 2:** Local event-log repository stores audit events in memory and mirrors domain-visible history into the apps/profile stores where applicable.
- [ ] **Step 3:** Local app-log repository writes `warn`/`error` to console only in development and never stores resume/cover-letter contents.
- [ ] **Step 4:** Tests assert append/read behavior and redaction of forbidden metadata keys: `token`, `apiKey`, `rawFile`, `resumeText`, `coverLetterText`.
- [ ] **Step 5:** Commit `feat(logging): local audit and app log repository`.

### Task 15: Wire audit events through store actions

**Files:** `src/lib/store/apps-store.ts`, `src/lib/store/profile-store.ts`, `src/lib/store/notifications-store.ts`, `tests/unit/store/audit-events.test.ts`.

- [ ] **Step 1:** Store actions append audit events for created, status changed, reordered, fields edited, wishlist added, application submitted, comment changed, profile changed, notification read/dismissed, and demo reset.
- [ ] **Step 2:** Preserve existing user-visible history rows for application events.
- [ ] **Step 3:** Tests assert representative actions append audit events with `entityType`, `entityId`, `event`, `createdAt`, and `ownerUserId`.
- [ ] **Step 4:** Commit `feat(logging): wire audit events to stores`.

### Task 16: Client error boundary

**Files:** `src/app/error.tsx`, `src/components/ui/ErrorPanel.tsx`, `tests/unit/components/ui/ErrorPanel.test.tsx`.

- [ ] **Step 1:** Add App Router client error boundary that renders a token-styled error panel with "Try again" and "Reset demo data" actions.
- [ ] **Step 2:** Boundary logs an `AppLog` event using the local event-log repository.
- [ ] **Step 3:** Test `ErrorPanel` renders actions and invokes callbacks.
- [ ] **Step 4:** Commit `feat(logging): client error boundary`.

### Task 17: Supabase migration handoff doc

**Files:** `docs/backend/supabase-roadmap.md`.

- [ ] **Step 1:** Document the local adapter contract and default `NEXT_PUBLIC_PERSISTENCE_ADAPTER=local`.
- [ ] **Step 2:** Document proposed tables from spec §11.5, RLS policy shape, and auth posture.
- [ ] **Step 3:** Document migration milestones: schema, read-path, write-path, logging, auth.
- [ ] **Step 4:** Commit `docs: Supabase migration roadmap`.

---

## Phase E — Accessibility and Final Handoff (Tasks 18–21)

### Task 18: Accessibility audit

**Files:** relevant component files, `tests/e2e/accessibility-keyboard.spec.ts`.

- [ ] **Step 1:** Keyboard-test topbar, board card focus, modal close, tab switching, status/priority menus, Apply radio groups, Profile tabs.
- [ ] **Step 2:** Ensure all icon-only buttons have `aria-label`, contentEditable title has `role="textbox"` and `aria-multiline="false"`, and modal dialogs expose readable labels.
- [ ] **Step 3:** Ensure drag/drop supports keyboard sensor and visible focus states.
- [ ] **Step 4:** Commit `fix(a11y): keyboard and labeling pass`.

### Task 19: Performance and bundle sanity

**Files:** `next.config.ts`, route/component files as needed.

- [ ] **Step 1:** Run `pnpm build` and record route sizes in `docs/deployment/build-report.md`.
- [ ] **Step 2:** Split any component file that exceeds 500 lines and has unrelated responsibilities, preserving behavior and tests.
- [ ] **Step 3:** Ensure no client component imports Node-only modules and no route triggers avoidable dynamic rendering.
- [ ] **Step 4:** Commit `refactor: route-level bundle sanity pass`.

### Task 20: Final verification

**Files:** none.

- [ ] **Step 1:** Run `pnpm lint && pnpm typecheck && pnpm test:unit && pnpm test:e2e && pnpm build`.
- [ ] **Step 2:** Manual production-like walkthrough: all five top-level views, all modal deep links, apply flow, reset flow, DemoOnly toast, direct refresh on modal routes.
- [ ] **Step 3:** Verify local-only runtime has no required env vars and no Supabase network calls.
- [ ] **Step 4:** Commit `chore: Plan 4 verification checkpoint`.

### Task 21: Release PR checklist

**Files:** `docs/deployment/release-checklist.md`, `README.md`.

- [ ] **Step 1:** Add release checklist covering CI status, Vercel preview URL, manual smoke, known limitations, rollback instructions, and Patch branch procedure.
- [ ] **Step 2:** Update README status section to list Plan 1–4 completion criteria and current runtime limitations.
- [ ] **Step 3:** Commit `docs: release checklist and handoff`.

---

## What Plan 4 ships

- GitHub Actions for quality checks and E2E.
- Branch protection and Vercel deployment guidance.
- Full Playwright regression coverage for all top-level flows and deep-link modal routes.
- Central DemoOnly and demo-data labeling pass.
- Local audit/app logging interface and store wiring.
- Accessibility, error-boundary, performance, and release handoff polish.

## Spec coverage check (Plan 4)

| Spec § | Plan 4 coverage |
| --- | --- |
| §11.5 Supabase/logging roadmap | Tasks 14–17 |
| §13 Accessibility | Task 18 |
| §14 Testing | Tasks 5–10, 20 |
| §15 CI/CD + branching + deploy | Tasks 1–4, 21 |
| §8.17 Demo-only controls | Task 11 |
| Finding #12 demo data labels | Task 12 |
