# JobTracker — Plan 1: Foundation + Board + Card Detail

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Each task maps 1:1 to a Linear issue (see workflow below) so work is resumable mid-task across sessions.

**Goal:** Ship a deployable Next.js app with the full Board view (drag-drop, filters, sort modes) and the full Card Detail modal (6 tabs + side panel + parallel routes), backed by Zustand stores with localStorage persistence and seeded from typed mock data.

**Architecture:** Next.js 15 App Router + TypeScript strict. Repository layer (local adapter only in this plan) sits between Zustand stores and persistence so a Supabase adapter can drop in later (Plan 4+). URL is canonical for view + open modal; Zustand owns persisted domain data. Modals use parallel + intercepting routes so `/card/JT-34` is shareable, refreshable, and back-button-closeable.

**Tech Stack:** Next.js 15, TypeScript 5 strict, Tailwind CSS v4, Zustand + persist, Radix UI, @dnd-kit, framer-motion, date-fns, react-hook-form, zod, Vitest + RTL, Playwright, ESLint + Prettier, Husky + lint-staged, pnpm.

**Spec:** `docs/superpowers/specs/2026-05-08-jobtracker-design.md` — every task references spec sections by number (e.g., "spec §8.2"). Read those sections before implementing the task; the plan tells you _what_ to build, the spec tells you _how it should look_.

**Style note:** This plan is intentionally light on code. It shows the file, the intent, and the verifiable outcome. Where code is shown, it's because the choice isn't obvious from the spec or from standard library docs. Use the spec for visual fidelity, store-action shapes, and type definitions.

---

## Linear + GitHub Workflow (read before starting)

Each task in this plan corresponds to one Linear issue under team `Nnetraganti` (key `NNE`), project `JobTracker`. Issue IDs are written into each task header as `### Task N (NNE-XXX): …` after issues are created.

### One-time setup (user does this manually, before Task 1)

1. **Push the empty repo and create branches** from this directory:
   - `git remote add origin https://github.com/agenticCoder97/jobTracker.git`
   - `git branch -M main && git commit --allow-empty -m "chore: initial empty commit" && git push -u origin main`
   - Create + push `Production`, `Development`, `Patch` branches off `main`.
   - Stay on `Development`.
2. **Connect Linear → GitHub.** Linear Settings → Integrations → GitHub → authorize for `agenticCoder97/jobTracker`.
3. **Configure Linear automation.** Settings → Workflows → Nnetraganti team:
   - Branch push `nick/nne-XXX-…` → issue moves to **In Progress**.
   - PR open referencing issue → **In Review**.
   - PR merged → **Done**.
4. **Set up Vercel.** Connect project to `agenticCoder97/jobTracker`. Production Branch = `Production`. Verify preview deploys fire on Development pushes.

### Per-task workflow

1. Pick next unstarted issue → assign self → **In Progress**.
2. `git checkout Development && git pull && git checkout -b nick/nne-XXX-task-N-short-name`.
3. Open this plan, find `### Task N`, execute steps in order.
4. Flip `- [ ]` → `- [x]` as steps complete; commit checkbox flips alongside the implementation commit.
5. Commit with `Refs NNE-XXX` (incremental) or `Fixes NNE-XXX` (final).
6. Push, open PR to `Development`. Merge after CI green (CI lands in Plan 4; until then, run `pnpm lint && pnpm typecheck && pnpm test:unit && pnpm build` locally).

### Resuming a stopped task

1. Find your **In Progress** issue.
2. `git fetch && git checkout nick/nne-XXX-… && git pull`.
3. Open this plan, find the task, find the first unchecked `- [ ]` step. Continue from there.
4. `git log --oneline | grep NNE-XXX` shows what's already landed if checkboxes weren't flipped.

### Branch + commit conventions

- Branch: `nick/nne-XXX-task-N-short-kebab-name`
- Commit: `<type>: <imperative summary>\n\nRefs NNE-XXX` or `Fixes NNE-XXX`. Types: `feat | fix | chore | refactor | test | docs | ci | style`.

### Plan-checkbox discipline

The single source of truth for task progress is the `- [ ]` / `- [x]` state in this file. Always commit checkbox flips together with the code that completed them. Never check a box you haven't actually finished.

---

## Phase A — Project Bootstrap (Tasks 1–7)

### Task 1: Initialize Next.js scaffold

**Files:** `package.json`, `tsconfig.json`, `next.config.ts`, `src/app/`, `public/`, `.gitignore`, `eslint.config.mjs`, `postcss.config.mjs`.

- [ ] **Step 1:** Run `pnpm create next-app@latest . --typescript --tailwind --eslint --app --src-dir --turbopack --import-alias "@/*" --use-pnpm --skip-install`. When asked about non-empty dir, continue (it preserves `.git/`, `docs/`, `.design-bundle/`).
- [ ] **Step 2:** `pnpm install`.
- [ ] **Step 3:** `pnpm dev` → confirm landing page at `http://localhost:3000`. Stop.
- [ ] **Step 4:** `pnpm build` → confirm clean build.
- [ ] **Step 5:** Append to `.gitignore`: `.design-bundle/`, `.vercel/`, `playwright-report/`, `test-results/`, `coverage/`.
- [ ] **Step 6:** Commit `chore: initialize Next.js scaffold`.

### Task 2: Install runtime dependencies

**Files:** `package.json`, `pnpm-lock.yaml`.

- [ ] **Step 1:** Install in one command:
  ```
  zustand @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
  @radix-ui/react-{dialog,dropdown-menu,popover,tabs,tooltip,checkbox,radio-group,select,slot}
  framer-motion date-fns react-hook-form @hookform/resolvers zod clsx tailwind-merge
  ```
- [ ] **Step 2:** Verify `pnpm exec tsc --noEmit` runs clean.
- [ ] **Step 3:** Commit `chore: add runtime deps`.

### Task 3: Install dev dependencies

**Files:** `package.json`, `pnpm-lock.yaml`.

- [ ] **Step 1:** Install: `vitest @vitest/coverage-v8 jsdom @testing-library/{react,jest-dom,user-event} @vitejs/plugin-react @playwright/test prettier prettier-plugin-tailwindcss husky lint-staged @types/node` (all `-D`).
- [ ] **Step 2:** `pnpm exec playwright install chromium`.
- [ ] **Step 3:** Commit `chore: add dev deps`.

### Task 4: Strict TypeScript + path aliases

**Files:** `tsconfig.json`, `package.json`.

- [ ] **Step 1:** Edit `tsconfig.json`: enable `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noFallthroughCasesInSwitch`, `noUnusedLocals`, `noUnusedParameters`. Add path aliases for `@/*`, `@/components/*`, `@/lib/*`, `@/styles/*`. Include `tests/**/*` in `include`.
- [ ] **Step 2:** Add scripts: `typecheck` (`tsc --noEmit`), `test:unit` (`vitest run`), `test:unit:watch` (`vitest`), `test:e2e` (`playwright test`), `format` (`prettier --write .`), `format:check` (`prettier --check .`), `prepare` (`husky`).
- [ ] **Step 3:** `pnpm typecheck` clean.
- [ ] **Step 4:** Commit `chore: enable strict TS + path aliases`.

### Task 5: ESLint + Prettier configuration

**Files:** `eslint.config.mjs`, `.prettierrc.json`, `.prettierignore`.

- [ ] **Step 1:** Replace `eslint.config.mjs` with flat config extending `next/core-web-vitals` + `next/typescript`. Add rules: unused-vars with `^_` ignore, `consistent-type-imports`, no-console (allow warn/error), `react/jsx-curly-brace-presence: never`. Ignore `.next`, `node_modules`, `playwright-report`, `test-results`, `coverage`, `.design-bundle`.
- [ ] **Step 2:** `.prettierrc.json` — semi true, singleQuote true, trailingComma all, printWidth 100, plugin `prettier-plugin-tailwindcss`.
- [ ] **Step 3:** `.prettierignore` — same dirs as eslint + `*.md` (preserve plan/spec author formatting).
- [ ] **Step 4:** `pnpm lint && pnpm format` both clean.
- [ ] **Step 5:** Commit `chore: configure ESLint + Prettier`.

### Task 6: Vitest + RTL harness

**Files:** `vitest.config.ts`, `tests/setup.ts`, `tests/unit/smoke.test.ts`.

- [ ] **Step 1:** `vitest.config.ts` — `environment: 'jsdom'`, `setupFiles: ['./tests/setup.ts']`, `globals: true`, `css: true`, alias `@` → `src`, plugins `[react()]`. Coverage v8, exclude `app/`, `lib/data/seed/`.
- [ ] **Step 2:** `tests/setup.ts` — import `@testing-library/jest-dom/vitest`, `cleanup()` in `afterEach`. Polyfill `window.matchMedia` (framer-motion needs it). Polyfill `crypto.randomUUID` to **deterministic incrementing** UUIDs (`00000000-0000-0000-0000-NNNNNNNNNNNN`) so seed/snapshot tests are stable.
- [ ] **Step 3:** Smoke test asserts `1 + 1 === 2`. Run `pnpm test:unit` → 1 pass.
- [ ] **Step 4:** Commit `test: configure Vitest + RTL harness`.

### Task 7: Husky + lint-staged + Playwright config

**Files:** `.husky/pre-commit`, `playwright.config.ts`, `tests/e2e/.gitkeep`, `package.json`.

- [ ] **Step 1:** `pnpm exec husky init`. Replace `.husky/pre-commit` body with `pnpm exec lint-staged`.
- [ ] **Step 2:** Add `"lint-staged"` to `package.json`: `*.{ts,tsx}` → `prettier --write`, `eslint --fix`. `*.{json,css,md}` → `prettier --write`.
- [ ] **Step 3:** `playwright.config.ts` — `testDir: './tests/e2e'`, `baseURL: 'http://localhost:3000'`, chromium project, `webServer` runs `pnpm dev`.
- [ ] **Step 4:** `mkdir -p tests/e2e && touch tests/e2e/.gitkeep`.
- [ ] **Step 5:** Verify hook fires (touch a file, `git commit`, observe lint-staged run, then revert).
- [ ] **Step 6:** Commit `chore: configure Husky + lint-staged + Playwright`.

---

## Phase B — Design System Foundation (Tasks 8–11)

### Task 8: Port design tokens

**Files:** `src/styles/tokens.css`.

- [ ] **Step 1:** Copy `.design-bundle/software-engineer/project/tokens.css` verbatim to `src/styles/tokens.css`. Do not edit values.
- [ ] **Step 2:** Commit `style: port design tokens from prototype`.

### Task 9: Wire Tailwind v4 to tokens

**Files:** `src/app/globals.css`, `postcss.config.mjs`.

- [ ] **Step 1:** Replace `globals.css` with: `@import "../styles/tokens.css";` then `@import "tailwindcss";` then `@theme inline { --color-bg: var(--bg); --color-surface: var(--surface); --color-elevated: var(--elevated); --color-border: var(--border); --color-muted: var(--muted); --color-body: var(--body); --color-white: var(--white); --color-gold: var(--gold); --color-success: var(--success); --color-warning: var(--warning); --color-error: var(--error); --font-sans: var(--font-ui); --font-serif: var(--font-reader); --font-mono: var(--font-mono); --radius-sm: var(--radius-sm); --radius-md: var(--radius-md); --radius-lg: var(--radius-lg); --radius-xl: var(--radius-xl); --radius-pill: var(--radius-pill); }`.
- [ ] **Step 2:** Verify utilities resolve: temporarily set `<body className="bg-bg text-body">` in `app/layout.tsx` → `pnpm dev` → background should be near-black `#0A0A0B`. Revert the test edit.
- [ ] **Step 3:** Commit `style: wire Tailwind v4 to design tokens via @theme`.

### Task 10: Port component utility classes

**Files:** `src/app/globals.css` (append component layer).

- [ ] **Step 1:** Append `@layer components { … }` block. Port from `.design-bundle/software-engineer/project/app.css` the following named utilities (selectors verbatim, properties verbatim): `.astral-card`, `.astral-gold-btn` + `:active`, `.astral-badge` + variants, `.app-card` + `.is-dragging` + `.is-priority-*`, `.column` + `.is-drag-over`, `.column__head`, `.column__dot`, `.column__title`, `.column__count`, `.column__more`, `.column__list`, `.column__add`, `.app-card__*`, `.chip` + `.is-tag`, `.filter-chip` + `.is-active`, `.filter-chip__count`, `.filter-divider`, `.filter-group`, `.view-toggle` + `.is-active`, `.modal-backdrop`, `.modal`, `.modal__head`, `.modal__crumbs`, `.modal__main`, `.modal__side`, `.modal__tabs`, `.modal__title`, `.modal__company-line`, `.modal__icon-btn`, `.modal__head-btns`, `.modal__section`, `.modal__desc`, `.status-pill`, `.status-menu`, `.status-menu__item`, `.priority-pill` + variants, `.side__group`, `.side__row`, `.side__label`, `.side__value`, `.salary-bar` + `__fill`, `.activity__*`, `.history-line`, `.linked-row` + `__type/title/meta`, `.attach-grid`, `.attach-card` + variants, `.ats-score-card` + parts, `.ats-bar` + `__fill`, `.ats-kw-grid`, `.ats-kw-head`, `.ats-kw-list`, `.ats-kw` + `.is-hit/is-miss/is-miss-soft`, `.ats-edits` + `__num`, `.ats-rewrite` + `__row/__label/.is-from/.is-to`, `.doc-link`, `.toast-host`, `.toast`. Skip view-specific styles (Research / Profile / Companies / Jobs / Resume Manager) — those land in Plans 2 and 3.
- [ ] **Step 2:** `pnpm build` clean (catches Tailwind/PostCSS issues with the layer).
- [ ] **Step 3:** Commit `style: port component utility classes from prototype`.

### Task 11: Fonts + Material Symbols

**Files:** `src/app/layout.tsx`.

- [ ] **Step 1:** In `src/app/layout.tsx`: load Inter via `next/font/google` with `subsets: ['latin']`, `variable: '--font-inter'`. Apply `${inter.variable}` to `<html>`. Override `--font-ui` in tokens.css OR set `font-family: var(--font-inter), …` on body.
- [ ] **Step 2:** In `<head>` of layout, add `<link rel="preconnect" href="https://fonts.googleapis.com">`, the `crossorigin` preconnect to gstatic, and the Material Symbols Rounded stylesheet (`family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@20,400,0,0&display=block`) — same as prototype HTML.
- [ ] **Step 3:** Update `<html lang="en">` and `<body>` className to apply `bg-bg text-body antialiased`.
- [ ] **Step 4:** `pnpm dev` → font + Material Symbols glyphs both render. Commit `feat: load Inter + Material Symbols fonts`.

---

## Phase C — Types + Seed Data (Tasks 12–18)

Reference: spec §5 (types) and §7 (seed data).

### Task 12: Type definitions

**Files:** `src/lib/types/index.ts`, `tests/unit/types-shape.test-d.ts` (type-only smoke).

- [ ] **Step 1:** Implement every type from spec §5 verbatim: primitives (`Uuid`, `IsoDateTime`, `IsoDate`, `StatusId`, `Priority`, `CompanyId`, `TeamId`, `RemoteMode`), `Audited`, `Application`, `Contact`, `Activity` + sub-types (`Comment`, `HistoryEvent`, `ApplicationLink`, `Attachment`), `Notification`, `Resume`, `CoverLetter`, `AppDocs`, `AtsResult`, `Profile` + sub-types (`ProfileLink`, `SearchPrefs`, `Experience`, `Education`, `Skill`, `Language`, `Cert`, `ProfileCompletenessSection`), `Company`, `CompanyDetail`, `JobListing`, `DailyPick`. Export `DEMO_USER_ID` constant.
- [ ] **Step 2:** Add a type-shape smoke test that constructs a minimal `Application` literal and asserts the compiler accepts it. Use `expectTypeOf` from `vitest`.
- [ ] **Step 3:** `pnpm typecheck && pnpm test:unit` clean. Commit `feat(types): add domain types`.

### Task 13: Date + utility helpers

**Files:** `src/lib/utils/dates.ts`, `src/lib/utils/cn.ts`, `tests/unit/utils/dates.test.ts`.

- [ ] **Step 1:** `dates.ts`: export `TODAY = new Date('2026-05-08')` (anchor for seed-derived dates), `daysAgo(n: number): IsoDate` (returns `TODAY - n` days), `daysFrom(date: IsoDate | Date, anchor: Date = TODAY): number`, `fmtDate(d: IsoDate | null | undefined): string` (returns `'—'` for nullish; otherwise `Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(...)`).
- [ ] **Step 2:** `cn.ts`: re-export `clsx` + merge with `tailwind-merge`. Standard pattern: `export const cn = (...xs) => twMerge(clsx(xs));`.
- [ ] **Step 3:** Tests: `daysAgo(7)` returns `'2026-05-01'`. `daysFrom('2026-05-01')` returns `7`. `fmtDate(null)` returns `'—'`. `fmtDate('2026-05-08')` returns `'May 8, 2026'`. `cn('a', false && 'b', 'c')` returns `'a c'`.
- [ ] **Step 4:** Commit `feat(utils): add dates + cn helpers`.

### Task 14: Icon map

**Files:** `src/lib/icon-map.ts`, `tests/unit/icon-map.test.ts`.

- [ ] **Step 1:** Port the `ICON_MAP` object from `.design-bundle/software-engineer/project/topbar.jsx` verbatim. Export as `const ICON_MAP: Record<string, string>`. Export `resolveIcon(name: string): string` returning `ICON_MAP[name] ?? name` (so callers can pass either lucide-style aliases or raw Material Symbols glyph names).
- [ ] **Step 2:** Tests: `resolveIcon('layout-dashboard')` → `'space_dashboard'`. `resolveIcon('rocket_launch')` → `'rocket_launch'` (passthrough). Unknown name passes through.
- [ ] **Step 3:** Commit `feat(icons): port lucide → Material Symbols map`.

### Task 15: ATS scoring + sort resolver

**Files:** `src/lib/utils/ats.ts`, `src/lib/utils/sort-resolver.ts`, `tests/unit/utils/ats.test.ts`, `tests/unit/utils/sort-resolver.test.ts`.

- [ ] **Step 1:** `ats.ts`: `computeAts({ resumeKeywords, required, nice }): AtsResult` (mirrors prototype's `makeATS` from `profile-data.js`). Pure, no side effects. Lower-case comparison. Score formula: `round((reqHit/required.length)*80 + (niceHit/max(1, nice.length))*20)`. `gradeFor(score: number): { label: string; color: string }` per spec §8.5 thresholds (≥85 Excellent green, ≥70 Strong gold, ≥50 Moderate warning, else Weak error).
- [ ] **Step 2:** `sort-resolver.ts`: `type SortMode = 'manual'|'lastActivity'|'priority'|'dateApplied'`. `resolveOrder(items: Application[], mode: SortMode): Application[]` per spec §6 "Board sort precedence" rules.
- [ ] **Step 3:** Tests: ATS happy path (a known fixture from `profile-data.js` matches expected score). gradeFor boundary cases (84, 85, 69, 70, 49, 50). sort-resolver: each mode produces expected order on a 4-application fixture; manual mode falls back to `updatedAt` on tie.
- [ ] **Step 4:** Commit `feat(utils): ATS scoring + board sort resolver`.

### Task 16: Seed — companies, statuses, team

**Files:** `src/lib/data/seed/{statuses,companies,company-details,team}.ts`, `src/lib/data/seed/index.ts` (barrel — incremental).

- [ ] **Step 1:** Port `STATUSES`, `COMPANIES`, `COMPANY_DETAILS`, `TEAM` constants from `.design-bundle/software-engineer/project/data.js` to typed `.ts` files. Companies record key matches `CompanyId` (slug like `'stripe'`). Add `id: CompanyId` field on every `CompanyDetail` entry.
- [ ] **Step 2:** Barrel re-exports them.
- [ ] **Step 3:** Type-shape tests: `STATUSES` length === 6, every entry satisfies `{ id: StatusId; title: string; … }`. `COMPANIES.stripe` exists.
- [ ] **Step 4:** Commit `feat(seed): port statuses, companies, team`.

### Task 17: Seed — applications + activity

**Files:** `src/lib/data/seed/applications.ts`, `src/lib/data/seed/activity.ts`, update `index.ts`.

- [ ] **Step 1:** Port `APPLICATIONS` array from `data.js`. For each, add `id: <deterministic UUID>` (use a helper `seedUuid(label: string)` that returns `00000000-0000-0000-0000-` + zero-padded ascending counter; map `displayId` → counter). Add `displayId: 'JT-XX'` (the original `id` from the prototype). Set `ownerUserId: DEMO_USER_ID`, `createdAt`/`updatedAt` from `daysAgo(...posted-or-applied)`, `deletedAt: null`, `sortIndex: <index in column>`, `archivedAt: null`, `sourceListingId: null`.
- [ ] **Step 2:** Port `ACTIVITY` map. Key by application UUID (translate via a `displayIdToUuid` map). Each `Comment`, `HistoryEvent`, `ApplicationLink`, `Attachment` gets a deterministic UUID via `seedUuid(...)`.
- [ ] **Step 3:** Tests: `seed.applications.length === 14` (matches prototype). Application with `displayId === 'JT-39'` has `status === 'applied'` and `activity[that.id].comments.length === 2`.
- [ ] **Step 4:** Commit `feat(seed): port applications + activity`.

### Task 18: Seed — profile, resumes, cover-letters, app-docs, notifications, listings, research

**Files:** `src/lib/data/seed/{profile,resumes,cover-letters,app-docs,notifications,daily-picks,job-listings,market,linkedin,companies-watch}.ts`, update `index.ts`.

- [ ] **Step 1:** Port the rest verbatim from `data.js` + `profile-data.js`. Resumes/CLs/Profile get `Audited` fields (UUID, ownerUserId = DEMO_USER_ID, timestamps from `daysAgo(...updated)`, `deletedAt: null`). `app-docs` keys by application UUID; references `resumeId` and `coverLetterId` by UUID (translate via the maps from Task 16/17).
- [ ] **Step 2:** Notifications get `id: Uuid`, `createdAt: IsoDateTime`. Drop the `read` field on the row (per spec §5/finding #7) — read state lives in the store as `readAt`/`dismissedAt`. The seed initializes those records as empty.
- [ ] **Step 3:** Add `seedAll()` to `src/lib/data/seed/index.ts` returning `{ applications, activity, appDocs, profile, resumes, coverLetters, notifications, statusSortMode: <each StatusId → 'lastActivity'> }`.
- [ ] **Step 4:** Tests: `seedAll().applications.length === 14`, `seedAll().resumes.length === 4`, `seedAll().coverLetters.length === 3`, `seedAll().notifications.length === 5`.
- [ ] **Step 5:** Commit `feat(seed): port profile, resumes, listings, research data`.

---

## Phase D — Repositories + Stores (Tasks 19–25)

Reference: spec §6 (state) and §11.5 (repository boundary).

### Task 19: Repository interfaces + local adapter

**Files:** `src/lib/repositories/types.ts`, `src/lib/repositories/local/{applications,profile,notifications,event-log}-repository.ts`, `src/lib/repositories/index.ts`.

- [ ] **Step 1:** `types.ts` defines async interfaces: `ApplicationsRepository` (`list`, `getById`, `getByDisplayId`, `create`, `update`, `delete`, `addActivityEvent`, `setStatusSortMode`), `ProfileRepository` (`get`, `update`, `listResumes`, `addResume`, `removeResume`, `setDefaultResume`, etc. — same for cover letters), `NotificationsRepository` (`list`, `markRead`, `markAllRead`, `dismiss`), `EventLogRepository` (`appendAuditEvent`, `appendAppLog`).
- [ ] **Step 2:** Local adapter implementations are thin pass-throughs over an in-memory state mirror that the Zustand store will own. The repository functions accept the current store state + a setter and return promises (always resolve immediately for v1). This keeps the call signatures backend-compatible without forcing async I/O in v1.
- [ ] **Step 3:** `index.ts` exports a singleton `repositories = { applications, profile, notifications, eventLog }` selecting the local adapter when `process.env.NEXT_PUBLIC_PERSISTENCE_ADAPTER !== 'supabase'` (the only path in Plan 1).
- [ ] **Step 4:** Tests: each repository's happy-path methods return expected shapes against a fixture state.
- [ ] **Step 5:** Commit `feat(repositories): local adapter + interface`.

### Task 20: Persist config + hydration hook

**Files:** `src/lib/store/persist-config.ts`, `src/lib/store/use-hydration.ts`, `tests/unit/store/persist-config.test.ts`.

- [ ] **Step 1:** `persist-config.ts` exports `makePersist<T>(name, version, partialize, migrate)` → returns a `PersistOptions` object with `storage: createJSONStorage(() => localStorage)`, `skipHydration: true`, the supplied `partialize` and `migrate`.
- [ ] **Step 2:** `use-hydration.ts` exports `useHydration()`: calls `useEffect(() => { useAppsStore.persist.rehydrate(); useProfileStore.persist.rehydrate(); useNotificationsStore.persist.rehydrate(); }, [])`. Returns a boolean `hydrated` set after all three resolve. Used to gate persisted-state-dependent UI.
- [ ] **Step 3:** Test: `makePersist` returns the expected shape; `migrate` invocation passes through.
- [ ] **Step 4:** Commit `feat(store): persist config + hydration hook`.

### Task 21: Apps store

**Files:** `src/lib/store/apps-store.ts`, `tests/unit/store/apps-store.test.ts`.

- [ ] **Step 1:** Implement `useAppsStore` per spec §6 (state slices + actions). Initialize from `seedAll()`. Persist key `jobtracker:apps:v1`. Partialize to `{ applications, activity, appDocs, statusSortMode }`. Every mutation appends a `HistoryEvent` to `activity[id].history`, bumps `application.lastActivity` and `application.updatedAt`, and calls `repositories.eventLog.appendAuditEvent({ event, entityType: 'application', entityId, ... })`.
- [ ] **Step 2:** `applyCard(id, { resumeId, coverLetterId })` sets `status: 'applied'`, `applied: today()`, `progress: max(20, current)`, calls `useProfileStore.getState().incrementResumeUse(resumeId)` and the cover-letter analogue if set. Adds an `appDocs[id]` entry with computed ATS via `computeAts`.
- [ ] **Step 3:** `moveStatus` / `reorderInStatus` follow sort-precedence rules from spec §6.
- [ ] **Step 4:** Tests: each action mutates state correctly, history gets a typed event, lastActivity bumps. `applyCard` triggers cross-store side effect (mock the profile store's `incrementResumeUse`).
- [ ] **Step 5:** Commit `feat(store): applications store with actions`.

### Task 22: Profile store

**Files:** `src/lib/store/profile-store.ts`, `tests/unit/store/profile-store.test.ts`.

- [ ] **Step 1:** Implement `useProfileStore` per spec §6. Persist key `jobtracker:profile:v1`. Actions: `updateProfile`, `updateAbout(text)` (the one editable field in v1 — see §8.16), `addResume`, `removeResume`, `setDefaultResume`, `editResume`, `incrementResumeUse`; same for cover letters.
- [ ] **Step 2:** Tests: `updateAbout` mutates `profile.about` and bumps `profile.updatedAt`. `setDefaultResume` clears default on others. `incrementResumeUse` bumps `timesUsed`.
- [ ] **Step 3:** Commit `feat(store): profile store`.

### Task 23: Notifications store

**Files:** `src/lib/store/notifications-store.ts`, `tests/unit/store/notifications-store.test.ts`.

- [ ] **Step 1:** Implement per spec §6: state `{ notifications, readAt, dismissedAt }`. Selectors `selectUnread`. Actions: `markRead`, `markAllRead`, `dismiss`. Persist key `jobtracker:notifications:v1`. Partialize all three slices.
- [ ] **Step 2:** Tests: `markRead` populates `readAt[id]`; `selectUnread` excludes read. `markAllRead` populates all. `dismiss` populates `dismissedAt[id]`.
- [ ] **Step 3:** Commit `feat(store): notifications store with read/dismissed`.

### Task 24: UI store

**Files:** `src/lib/store/ui-store.ts`, `tests/unit/store/ui-store.test.ts`.

- [ ] **Step 1:** Implement `useUiStore` (NOT persisted) per spec §6: board filters (chip set, company/location/tags filters, view mode), companies search/sort, toasts. **Do not include** Jobs filters or Profile tab — those are URL-canonical (URL is the source of truth; components read via `useSearchParams`).
- [ ] **Step 2:** Toast helper `pushToast({ kind, message })` with auto-dismiss after 2.8s. Variants: `success` (default), `info`, `error`.
- [ ] **Step 3:** Tests: filter setters mutate state; `pushToast` adds + auto-removes (use `vi.useFakeTimers()`).
- [ ] **Step 4:** Commit `feat(store): UI store with filters + toasts`.

### Task 25: Demo-data reset

**Files:** `src/lib/store/reset-demo-data.ts`, `tests/unit/store/reset-demo-data.test.ts`.

- [ ] **Step 1:** Export `resetDemoData()`: clears all `jobtracker:*` localStorage keys, calls each persisted store's `useStore.persist.clearStorage()`, re-hydrates from seed via `useStore.setState(seedSlice)`.
- [ ] **Step 2:** Test: state mutates → reset → state matches seed.
- [ ] **Step 3:** Commit `feat(store): reset demo data action`.

---

## Phase E — Shared UI Primitives (Tasks 26–32)

Reference: spec §3 (component list) and §12 (styles).

### Task 26: Icon + CompanyLogo + Avatar primitives

**Files:** `src/components/ui/{Icon,CompanyLogo,Avatar,AvatarStack}.tsx`, `tests/unit/components/ui/Icon.test.tsx`.

- [ ] **Step 1:** `Icon`: renders `<span className="material-symbols-rounded">{resolveIcon(name)}</span>` with inline `style` for `fontSize`, `width`, `height`, and `font-variation-settings`. Accept `size = 16` and `style` prop.
- [ ] **Step 2:** `CompanyLogo({ company, size = 32, radius = 6 })`: reads from seed `COMPANIES`, returns square with bg color + initial; honors `dark` (text color) and `ring` (border) variants.
- [ ] **Step 3:** `Avatar({ who, size = 22 })`: reads from seed `TEAM`. `AvatarStack` lays children in negative-margin overlap.
- [ ] **Step 4:** Test: `Icon name="rocket"` renders `<span>` with text `rocket_launch`.
- [ ] **Step 5:** Commit `feat(ui): Icon + CompanyLogo + Avatar primitives`.

### Task 27: Chip + Pill + GoldButton + Kbd

**Files:** `src/components/ui/{Chip,Pill,GoldButton,Kbd}.tsx`.

- [ ] **Step 1:** `Chip`: pill chrome via `.chip` utility class; variants `default | tag | priority-high | priority-med | priority-low | success | warning | error`. Accept `leadingIcon` prop.
- [ ] **Step 2:** `Pill`: similar but for status pills (clickable chrome). `GoldButton` wraps `.astral-gold-btn`. `Kbd` renders `<kbd>` with mono font + muted bg.
- [ ] **Step 3:** Snapshot or class-presence tests for variants.
- [ ] **Step 4:** Commit `feat(ui): Chip, Pill, GoldButton, Kbd`.

### Task 28: Radix wrappers — Dialog, DropdownMenu, Popover, Tooltip, Tabs

**Files:** `src/components/ui/{Dialog,DropdownMenu,Popover,Tooltip,Tabs}.tsx`.

- [ ] **Step 1:** Each wraps the corresponding Radix primitive, applying token-styled chrome (border `var(--border)`, bg `var(--surface)`, radius `var(--radius-lg)`, shadow `var(--shadow-pop)` for Dialog/Popover/DropdownMenu). Animations via framer-motion `AnimatePresence` for enter/exit (respect `prefers-reduced-motion`).
- [ ] **Step 2:** `Dialog` exports `DialogRoot`, `DialogContent`, `DialogClose`; `Tabs` exports `TabsRoot`, `TabsList`, `TabsTrigger`, `TabsContent`. Same for the others.
- [ ] **Step 3:** Smoke test: `<DialogRoot open><DialogContent>hi</DialogContent></DialogRoot>` renders content; close button calls `onOpenChange(false)`.
- [ ] **Step 4:** Commit `feat(ui): Radix wrappers (Dialog, DropdownMenu, Popover, Tooltip, Tabs)`.

### Task 29: StatusPill + PriorityPill (popover-driven)

**Files:** `src/components/ui/{StatusPill,PriorityPill}.tsx`, `tests/unit/components/ui/StatusPill.test.tsx`.

- [ ] **Step 1:** `StatusPill({ status, onChange })`: Renders trigger as `<Pill>` with `STATUSES[status].dot` color + title + chevron. Click → DropdownMenu lists all statuses with check on current. Selecting calls `onChange(newStatusId)`.
- [ ] **Step 2:** `PriorityPill({ value, onChange })`: same pattern with priority options.
- [ ] **Step 3:** Test: clicking trigger opens menu (Radix portals into DOM); clicking an option calls `onChange` with new value and closes menu.
- [ ] **Step 4:** Commit `feat(ui): StatusPill + PriorityPill`.

### Task 30: ProgressBar + ScoreBar + ScoreRing

**Files:** `src/components/ui/{ProgressBar,ScoreBar,ScoreRing}.tsx`.

- [ ] **Step 1:** `ProgressBar({ value, color = 'var(--gold)' })` thin horizontal bar (used in ApplicationCard).
- [ ] **Step 2:** `ScoreBar({ value, color })` larger horizontal (used in ATS panel).
- [ ] **Step 3:** `ScoreRing({ value, color, size = 80 })` not in v1 (the prototype uses big number, not a ring); implement as a stub returning a styled big number for now. Reserved for future.
- [ ] **Step 4:** Commit `feat(ui): ProgressBar + ScoreBar`.

### Task 31: Toast + ToastHost + EmptyState

**Files:** `src/components/ui/{Toast,ToastHost,EmptyState}.tsx`, `tests/unit/components/ui/ToastHost.test.tsx`.

- [ ] **Step 1:** `ToastHost`: renders fixed bottom-center container, subscribes to `useUiStore.toasts`, animates in/out with framer-motion.
- [ ] **Step 2:** `Toast`: variants success/info/error with leading icon (check_circle / info / cancel).
- [ ] **Step 3:** `EmptyState({ icon, title, description, action? })` — dashed border, centered, muted.
- [ ] **Step 4:** Test: pushing a toast renders it; after 2.8s with fake timers it's removed.
- [ ] **Step 5:** Commit `feat(ui): Toast + ToastHost + EmptyState`.

### Task 32: DemoOnly wrapper

**Files:** `src/components/ui/DemoOnly.tsx`, `tests/unit/components/ui/DemoOnly.test.tsx`.

- [ ] **Step 1:** `<DemoOnly label="Account settings">{children}</DemoOnly>` wraps interactive children; intercepts onClick → calls `pushToast({ kind: 'info', message: \`Demo only — '${label}' isn't wired up yet.\` })`. Adds Tooltip "Demo only — coming in a future release". Adds `data-demo-only="true"` to the root.
- [ ] **Step 2:** Test: clicking child fires toast (mock `pushToast`); has `data-demo-only` attribute; original `onClick` is NOT called (assert via spy).
- [ ] **Step 3:** Commit `feat(ui): DemoOnly wrapper for stub controls`.

---

## Phase F — TopBar (Tasks 33–37)

Reference: spec §8.1.

### Task 33: BrandMark + NavTabs

**Files:** `src/components/topbar/{BrandMark,NavTabs}.tsx`.

- [ ] **Step 1:** `BrandMark`: gold star (★ glyph) + "JobTrack" wordmark. `<Link href="/">`.
- [ ] **Step 2:** `NavTabs`: 4 buttons (Home/Jobs/Companies/Research) with icons (spec §8.1). Active state derived from `usePathname()` (`/` → Home, `/jobs` → Jobs, etc.). Each is a `<Link>`.
- [ ] **Step 3:** Commit `feat(topbar): BrandMark + NavTabs`.

### Task 34: SearchTrigger + CreateButton

**Files:** `src/components/topbar/{SearchTrigger,CreateButton}.tsx`.

- [ ] **Step 1:** `SearchTrigger`: `<Link href="/jobs?focus=search">` styled as the search input pill (search icon + readonly placeholder + `<Kbd>⌘K</Kbd>`). Visual stub — no command palette in Plan 1.
- [ ] **Step 2:** `CreateButton`: gold pill. Click → calls `useAppsStore.getState().createCard('wishlist')` and pushes `/card/<newDisplayId>`.
- [ ] **Step 3:** Commit `feat(topbar): SearchTrigger + CreateButton`.

### Task 35: NotificationsPopover

**Files:** `src/components/topbar/NotificationsPopover.tsx`, `tests/unit/components/topbar/NotificationsPopover.test.tsx`.

- [ ] **Step 1:** Bell icon button with absolute-positioned blue dot when `selectUnread(state).length > 0`. Click opens Popover.
- [ ] **Step 2:** Popover: header "Notifications" + "Mark all read" link (calls `markAllRead`). List of notifications with read/unread visual state derived from `readAt`.
- [ ] **Step 3:** Test: render with 2 unread → dot visible; click "Mark all read" → all rows render as read; dot disappears.
- [ ] **Step 4:** Commit `feat(topbar): NotificationsPopover`.

### Task 36: AvatarDropdown

**Files:** `src/components/topbar/AvatarDropdown.tsx`, `tests/unit/components/topbar/AvatarDropdown.test.tsx`.

- [ ] **Step 1:** "YO" avatar button → DropdownMenu with header (avatar + "You · @youruser" + email) + separator + 6 menu items (Profile/Account settings/Notification preferences/Appearance/Help/Logout) per spec §8.1. Each menu item has icon + label + optional `<Kbd>` shortcut.
- [ ] **Step 2:** "Profile" → `<Link href="/profile">`. All other items wrapped in `<DemoOnly label="...">`. Logout has `is-danger` styling.
- [ ] **Step 3:** Test: rendering shows all 6 items; clicking "Account settings" fires demo toast (mock); clicking "Profile" navigates (mock router).
- [ ] **Step 4:** Commit `feat(topbar): AvatarDropdown`.

### Task 37: TopBar composition + layout integration

**Files:** `src/components/topbar/TopBar.tsx`, `src/app/layout.tsx`.

- [ ] **Step 1:** `TopBar` composes Brand + NavTabs + SearchTrigger + (Create + Notifications + Avatar) right cluster. Uses CSS grid or flex per prototype.
- [ ] **Step 2:** In `app/layout.tsx`: wrap `{children}` with `<TopBar />` above + `<ToastHost />` after. Add `useHydration()` call inside a client wrapper component to trigger persisted-store rehydration.
- [ ] **Step 3:** Smoke render the layout with a stub child; `pnpm dev` shows the top bar with all controls visible.
- [ ] **Step 4:** Commit `feat(topbar): compose TopBar + integrate into layout`.

---

## Phase G — Board view (Tasks 38–43)

Reference: spec §8.2.

### Task 38: TitleRow

**Files:** `src/components/board/TitleRow.tsx`.

- [ ] **Step 1:** Renders h1 "Job Search · Spring 2026" + breadcrumbs "Workspace / Personal / Board" + counter `<b>X</b> applications · <b>Y</b> active` (active = status ≠ rejected). Reads from `useAppsStore`.
- [ ] **Step 2:** Commit `feat(board): TitleRow`.

### Task 39: FilterBar + ViewToggle

**Files:** `src/components/board/{FilterBar,ViewToggle}.tsx`, `tests/unit/components/board/FilterBar.test.tsx`.

- [ ] **Step 1:** `FilterBar`: 6 filter chips (All/Mine/High prio/Action this week/Remote only/Has referral) per spec §8.2. Each chip wires to `useUiStore.boardFilters`. Count badges computed from `applications`. Active chip → gold tint.
- [ ] **Step 2:** Below chips: 4 dropdown filter groups (Company / Location / Tags / Sort). Each is a Radix DropdownMenu with checkboxes (multi-select) or radios (Sort). Sort menu writes to per-status mode via `setStatusSortMode` for **all statuses** (global sort); Column-level menu can override per status.
- [ ] **Step 3:** `ViewToggle`: 3 segmented buttons (Board active by default; List + Timeline render `<EmptyState title="Coming soon" />` content when selected).
- [ ] **Step 4:** Test: clicking a chip toggles its active state; counts reflect filtered set.
- [ ] **Step 5:** Commit `feat(board): FilterBar + ViewToggle`.

### Task 40: ApplicationCard

**Files:** `src/components/board/ApplicationCard.tsx`, `tests/unit/components/board/ApplicationCard.test.tsx`.

- [ ] **Step 1:** Renders card chrome per spec §8.2 ApplicationCard subsection: top row (logo + role + company link + remote chip), chips row (priority + salary + tags), progress bar, footer (id + days + comment count + attachment count + owner avatar), CTA row.
- [ ] **Step 2:** CTA: wishlist → `<Link href="/apply/<displayId>">` "Apply now" gold pill. Other → `<Link href="/card/<displayId>">` "Track" muted pill.
- [ ] **Step 3:** Whole card click navigates to `/card/<displayId>` (except clicking company link which goes to `/company/<companyId>`, and except clicking the CTA button which has its own behavior).
- [ ] **Step 4:** Test: renders all chrome elements; clicking card calls navigation (mock router).
- [ ] **Step 5:** Commit `feat(board): ApplicationCard`.

### Task 41: Column

**Files:** `src/components/board/Column.tsx`, `tests/unit/components/board/Column.test.tsx`.

- [ ] **Step 1:** Header: dot + title + count + 3-dot more button. More button → DropdownMenu with sort options ("Sort by date / by priority / Manual"; "Collapse" wrapped in `<DemoOnly>`).
- [ ] **Step 2:** Card list (mapped ApplicationCards). Footer: "Add application" pill button → `useAppsStore.createCard(statusId)` + nav to new card modal.
- [ ] **Step 3:** Marks `data-status={statusId}` on the column root; gets `is-drag-over` class via `useDroppable` (wired in Task 42).
- [ ] **Step 4:** Test: renders count from items.length; clicking "Add application" creates card + navigates.
- [ ] **Step 5:** Commit `feat(board): Column`.

### Task 42: BoardView (drag-drop)

**Files:** `src/components/board/BoardView.tsx`, `src/app/page.tsx`, `tests/unit/components/board/BoardView.test.tsx`.

- [ ] **Step 1:** `BoardView` renders TitleRow + FilterBar + 6 columns inside a `<DndContext>`. Each Column wraps cards in `<SortableContext strategy={verticalListSortingStrategy}>`. ApplicationCard becomes a `useSortable` consumer (drag handle = whole card).
- [ ] **Step 2:** `onDragEnd`: same column → `reorderInStatus(statusId, newOrderedIds)`. Cross column → `moveStatus(activeId, targetStatusId)`. Both follow spec §6 sort precedence rules — drag forces `mode='manual'`.
- [ ] **Step 3:** Sensors: `PointerSensor` (with activation distance 6px to allow click vs drag distinction) + `KeyboardSensor` for a11y.
- [ ] **Step 4:** Apply per-status `resolveOrder(items, statusSortMode[statusId])` before passing to Column.
- [ ] **Step 5:** `app/page.tsx` is a thin client component: `'use client'` + renders `<BoardView />` after `useHydration()` resolves. SSR fallback shows skeleton columns.
- [ ] **Step 6:** Tests (RTL): drag simulation moves a card across columns and asserts store state changes (use `@dnd-kit` test utilities or just call the store actions directly to verify the wiring).
- [ ] **Step 7:** Commit `feat(board): BoardView with drag-drop + filtering`.

### Task 43: Filtering logic

**Files:** `src/components/board/use-filtered-apps.ts`, `tests/unit/components/board/use-filtered-apps.test.ts`.

- [ ] **Step 1:** Hook `useFilteredApps()` reads from `useAppsStore` + `useUiStore`. Applies chip filter (high/thisweek/remote/referral per spec §8.2; "All" / "Mine" pass-through), then dropdown filters (company/location/tags), then groups by status. Returns `{ byStatus: Record<StatusId, Application[]>, counts: Record<chipId, number> }`.
- [ ] **Step 2:** Test: each filter narrows correctly; `counts` are pre-filter (chip badges show total matching that filter applied alone).
- [ ] **Step 3:** Commit `feat(board): filtered-apps hook`.

---

## Phase H — Modal infra + Card Detail (Tasks 44–55)

Reference: spec §4 (routing), §8.3–§8.10.

### Task 44: Parallel route slot scaffolding

**Files:** `src/app/layout.tsx`, `src/app/@modal/default.tsx`.

- [ ] **Step 1:** Update `layout.tsx` signature to `({ children, modal }: { children: React.ReactNode; modal: React.ReactNode })`. Render `{children}` + `{modal}` in the body.
- [ ] **Step 2:** `@modal/default.tsx` returns `null`.
- [ ] **Step 3:** `pnpm dev` → board still renders. Commit `feat(routing): add @modal parallel slot`.

### Task 45: CardDetailDialog skeleton

**Files:** `src/components/card-detail/CardDetailDialog.tsx`, `tests/unit/components/card-detail/CardDetailDialog.test.tsx`.

- [ ] **Step 1:** Client component `CardDetailDialog({ displayId })`. Resolves application via `useAppsStore` (`getByDisplayId`). If not found → renders `<EmptyState title="Card not found" />` with a Close button.
- [ ] **Step 2:** Wraps body in `<DialogRoot open onOpenChange={(open) => !open && router.back()}>`. Esc / backdrop / X all flow through `onOpenChange`. If `router.back()` would leave the app, fall back to `router.replace('/')`.
- [ ] **Step 3:** Body = empty placeholder — sub-tasks fill it in.
- [ ] **Step 4:** Test: renders dialog when displayId resolves; renders not-found when it doesn't; close handler invoked on Esc.
- [ ] **Step 5:** Commit `feat(card-detail): CardDetailDialog skeleton`.

### Task 46: Canonical + intercepting card routes

**Files:** `src/app/card/[displayId]/page.tsx`, `src/app/@modal/(.)card/[displayId]/page.tsx`, `src/app/@modal/(..)jobs/(.)card/[displayId]/page.tsx`, `src/app/@modal/(..)companies/(.)card/[displayId]/page.tsx`, `src/app/@modal/(..)research/(.)card/[displayId]/page.tsx`, `src/app/@modal/(..)profile/(.)card/[displayId]/page.tsx`.

- [ ] **Step 1:** Canonical `/card/[displayId]/page.tsx`: server component that renders `<BoardView />` (the underlying view) + `<CardDetailDialog displayId={params.displayId} />`. This is the direct-load fallback per spec §4.
- [ ] **Step 2:** Each intercepting `(.)card/[displayId]/page.tsx` is a thin client shell rendering `<CardDetailDialog displayId={params.displayId} />` only — the underlying view is whatever `{children}` already renders.
- [ ] **Step 3:** Verify: `pnpm dev` → click a card on the board → URL changes to `/card/JT-XX`, dialog appears, board still visible behind it. Hard-refresh: same view. Press back: dialog closes, board view restored.
- [ ] **Step 4:** Commit `feat(routing): canonical + intercepting card routes`.

### Task 47: CardHeader + CardTitle

**Files:** `src/components/card-detail/{CardHeader,CardTitle}.tsx`.

- [ ] **Step 1:** `CardHeader` per spec §8.3 modal head: crumbs left + actions cluster right. "Apply now" pill appears only when status is wishlist (links to `/apply/<displayId>` — that route lands in Plan 2; render the link anyway). Watch/Star/Share/Archive/More icon buttons all wrapped in `<DemoOnly>`. Close calls `onClose` prop.
- [ ] **Step 2:** `CardTitle`: `<h1 contentEditable suppressContentEditableWarning role="textbox" aria-multiline="false" onBlur={(e) => updateApp(id, { role: e.currentTarget.textContent ?? '' })}>{role}</h1>`. Pressing Enter blurs.
- [ ] **Step 3:** Commit `feat(card-detail): header + editable title`.

### Task 48: CompanyLine + MetaRow

**Files:** `src/components/card-detail/{CompanyLine,MetaRow}.tsx`.

- [ ] **Step 1:** `CompanyLine`: 24px CompanyLogo + company link (→ `/company/<companyId>`) + location + bullet + "View original posting" link wrapped in `<DemoOnly>` (no real URL in v1).
- [ ] **Step 2:** `MetaRow`: StatusPill + PriorityPill + tag chips + "Applied <fmtDate>" chip + Next-action gold-tint chip (shown only when `nextAction` set).
- [ ] **Step 3:** Commit `feat(card-detail): CompanyLine + MetaRow`.

### Task 49: TabBar

**Files:** `src/components/card-detail/TabBar.tsx`.

- [ ] **Step 1:** Renders 6 tab triggers per spec §8.3 (Overview/Match/Activity/Attachments/Linked/History) using `<TabsRoot value={tab} onValueChange={setTab}>` + `<TabsList>`. Each trigger has icon + label + optional count badge (counts from `activity[id].comments|attachments|links|history.length`; Match shows `appDocs[id]?.ats.score` only if present).
- [ ] **Step 2:** Default tab `'overview'`. Tab state held by `CardDetailDialog` (URL-synced via `?tab=` is overkill for v1; in-memory is fine since modal already has stable URL).
- [ ] **Step 3:** Commit `feat(card-detail): TabBar`.

### Task 50: OverviewTab

**Files:** `src/components/card-detail/tabs/OverviewTab.tsx`.

- [ ] **Step 1:** Sections per spec §8.4: About the role (description) / What they want (requirements bullets) / Next action callout (with "Mark done" demo-only button) / Offer breakdown 4-tile grid (when `app.offer`) / Rejection reason red callout (when `app.rejectedReason`).
- [ ] **Step 2:** Each section renders only when its data is present.
- [ ] **Step 3:** Commit `feat(card-detail): OverviewTab`.

### Task 51: MatchTab (ATS)

**Files:** `src/components/card-detail/tabs/MatchTab.tsx`.

- [ ] **Step 1:** Sections per spec §8.5:
  - Documents linked: resume row + cover-letter row with Preview/Swap (demo-only).
  - ATS match score: big number colored by `gradeFor`; ScoreBar; ratio sub-line.
  - Keyword coverage: 2-column grid (Required hit/miss chips, Nice-to-have hit/miss chips).
  - Suggested edits: numbered list with "Apply" demo-only button per item.
  - Suggested rewrites: paired Current/Suggested rows with "Use this" demo-only button.
- [ ] **Step 2:** Empty state when `appDocs[id]` missing per spec.
- [ ] **Step 3:** Commit `feat(card-detail): MatchTab (ATS panel)`.

### Task 52: ActivityTab

**Files:** `src/components/card-detail/tabs/ActivityTab.tsx`, `tests/unit/components/card-detail/ActivityTab.test.tsx`.

- [ ] **Step 1:** Composite comment input: textarea + 3 icon buttons (attach/mention/emoji — demo-only) + Cancel + Comment (gold pill, disabled if empty). Submit calls `addComment(applicationId, text)`.
- [ ] **Step 2:** Comment thread below: each = team-color avatar + bubble (name + timestamp + body). Empty state per spec.
- [ ] **Step 3:** Test: typing + Comment click adds entry to `activity[id].comments`; textarea clears.
- [ ] **Step 4:** Commit `feat(card-detail): ActivityTab`.

### Task 53: AttachmentsTab + LinkedTab + HistoryTab

**Files:** `src/components/card-detail/tabs/{AttachmentsTab,LinkedTab,HistoryTab}.tsx`.

- [ ] **Step 1:** `AttachmentsTab` per spec §8.7: action row (Upload file / Attach link — both demo-only) + grid of attach cards (kind icon + name + size · date). Empty state per spec.
- [ ] **Step 2:** `LinkedTab` per spec §8.8: action row (Link item / Link to another card — both demo-only) + linked-row list. Empty state.
- [ ] **Step 3:** `HistoryTab` per spec §8.9: timeline (most-recent first) of `activity[id].history` events. Each row = type-icon + text + right-aligned date.
- [ ] **Step 4:** Commit `feat(card-detail): Attachments + Linked + History tabs`.

### Task 54: SidePanel + 6 groups

**Files:** `src/components/card-detail/side/{SidePanel,StatusGroup,RoleGroup,CompensationGroup,TimelineGroup,SourceGroup,WatchersGroup}.tsx`.

- [ ] **Step 1:** Implement each group per spec §8.10. `StatusGroup` reuses StatusPill + PriorityPill + Avatar(me). `RoleGroup` shows company (link), level, team, location, work-mode (with mode-icon). `CompensationGroup` shows salary + equity + salary-band-bar (computed `(salaryMin - 120) / (420 - 120)` left + `(420 - salaryMax) / (420 - 120)` right offsets). `TimelineGroup` shows posted/applied/days-pending/last-activity/next-due (red if overdue). `SourceGroup` shows source/referral/tags (with demo-only "+ tag" button). `WatchersGroup` shows AvatarStack + demo-only "+ watcher".
- [ ] **Step 2:** `SidePanel` composes them in order.
- [ ] **Step 3:** Commit `feat(card-detail): SidePanel + 6 groups`.

### Task 55: Wire CardDetailDialog body

**Files:** `src/components/card-detail/CardDetailDialog.tsx` (final pass).

- [ ] **Step 1:** Body layout: 2-column grid. Left = CardHeader sticky + CompanyLine + MetaRow + TabBar + active tab content. Right = SidePanel (scrolls independently).
- [ ] **Step 2:** Tab state hook + content switch via `<TabsContent value=…>` from Radix Tabs.
- [ ] **Step 3:** E2E smoke test (`tests/e2e/card-detail.spec.ts`): goto `/`, click first card, assert dialog opens, click each of 6 tabs, assert content swaps, add a comment in Activity, refresh — comment persists. Press Esc — dialog closes, board visible.
- [ ] **Step 4:** Commit `feat(card-detail): wire dialog body + e2e smoke`.

---

## Phase I — Verification + handoff (Tasks 56–58)

### Task 56: Full local verification

**Files:** none — execution only.

- [ ] **Step 1:** `pnpm lint && pnpm typecheck && pnpm test:unit && pnpm build` all clean.
- [ ] **Step 2:** `pnpm test:e2e` passes the smoke test from Task 55.
- [ ] **Step 3:** `pnpm dev` walkthrough:
  - Board renders with 14 seeded cards across 6 columns.
  - Filter chips toggle correctly; counts match.
  - Drag a card from Wishlist → Applied. Refresh page. Verify it stayed.
  - Open card JT-34 (Ramp). Verify all 6 tabs render content. Add a comment, refresh, persists.
  - Click "Apply now" on a wishlist card → routes to `/apply/<id>` (renders not-yet-implemented placeholder; that route is Plan 2).
  - Notifications popover: see seed unread; "Mark all read" clears the dot.
  - Avatar dropdown: "Profile" navigates to `/profile` (will render an empty placeholder — Profile page is Plan 3); other items fire Demo toast.
  - Reset demo data (call from devtools console: `useAppsStore.persist.clearStorage(); location.reload()`) — board returns to seed.
- [ ] **Step 4:** Commit `chore: Plan 1 verification checkpoint`.

### Task 57: Placeholder Jobs / Companies / Research / Profile / Apply pages

**Files:** `src/app/jobs/page.tsx`, `src/app/companies/page.tsx`, `src/app/research/page.tsx`, `src/app/profile/page.tsx`, `src/app/apply/[displayId]/page.tsx`.

- [ ] **Step 1:** Each page renders `<EmptyState title="Coming soon" description="This view ships in Plan 2/3." />`. This keeps NavTabs functional and removes 404s.
- [ ] **Step 2:** Commit `feat: placeholder pages for Jobs/Companies/Research/Profile/Apply`.

### Task 58: README + handoff to Plan 2

**Files:** `README.md` (create or replace).

- [ ] **Step 1:** Brief README covering: what the app is, the link to spec + plans, dev commands, branch model, deploy pipeline, known limitations (Plan 1 ships only Board + Card Detail; Plan 2 adds Jobs/Companies/Apply; Plan 3 adds Research/Profile; Plan 4 adds CI/E2E suite).
- [ ] **Step 2:** Commit `docs: README + Plan 1 handoff notes`.

---

## What Plan 1 ships

After all 58 tasks merge to `Development`:

- Project scaffolds, builds, lints, typechecks, tests cleanly.
- Tokens + Tailwind v4 + Inter + Material Symbols all wired.
- Full type model + complete seed data, including UUID-augmented audit fields.
- Repository layer + 4 Zustand stores (apps/profile/notifications/ui) with localStorage persistence + versioned migrate + reset.
- Shared UI primitives (Icon/CompanyLogo/Avatar/Chip/Pill/Dialog/DropdownMenu/Popover/Tooltip/Tabs/StatusPill/PriorityPill/ProgressBar/ScoreBar/Toast/EmptyState/DemoOnly).
- TopBar fully functional (nav, notifications, avatar menu).
- Board view: title, filter bar, 6 columns, drag-drop, sort precedence, ApplicationCards.
- Card Detail modal: parallel + intercepting routes, header, editable title, company line, meta row, all 6 tabs (Overview/Match/Activity/Attachments/Linked/History), full SidePanel with all 6 groups.
- Apply flow: button wired, route exists as placeholder.
- Other top-level views (Jobs/Companies/Research/Profile): placeholder pages.
- Demo-only controls behave per spec (toast on click, no mutation).
- About inline-edit functional (Profile placeholder will use it in Plan 3; the store action exists in Plan 1).

The app is deployable to Vercel via `Development` branch push and the core "track applications" loop works end-to-end.

---

## Spec coverage check

After self-review against spec sections:

| Spec § | Plan 1 coverage |
| --- | --- |
| 1. Goal & scope | Header. |
| 2. Tech stack | Tasks 1–7. |
| 3. Project structure | Phases B/C/D/E/F/G/H create the relevant directories. Jobs/Companies/Research/Profile component dirs are created in Plans 2/3. |
| 4. Routing model | Tasks 44–46 (board + card modal). Other view modals in Plan 2. |
| 5. Data model | Task 12. |
| 6. State management | Tasks 19–25. URL-canonical state for Jobs/Profile lands in Plans 2/3. |
| 7. Seed data | Tasks 16–18. |
| 8.1 TopBar | Tasks 33–37. |
| 8.2 Board | Tasks 38–43. |
| 8.3–8.10 Card Detail | Tasks 45–55. |
| 8.11 Resume Picker (Apply) | Plan 2. |
| 8.12 Jobs | Plan 2. |
| 8.12.1 Job Listing Preview | Plan 2. |
| 8.13 Companies | Plan 2. |
| 8.14 Company Detail | Plan 2. |
| 8.15 Research | Plan 3. |
| 8.16 Profile | Plan 3 (About-edit store action lives in Task 22). |
| 8.17 Demo-only controls | Task 32 + applied throughout Phases F/G/H. |
| 9. Drag-and-drop | Task 42. |
| 10. ATS scoring | Task 15. |
| 11. Persistence layer | Task 20. |
| 11.5 Optional Supabase backend + logging | Repository layer scaffolded in Task 19 (local adapter only). Supabase adapter is Plan 4+. Logging hooks scaffolded in Task 21 (event-log calls). |
| 12. Styling | Tasks 8–11. |
| 13. Accessibility | Radix wrappers (Task 28) handle the bulk; dnd-kit keyboard sensor (Task 42); contentEditable a11y (Task 47). Full audit in Plan 4. |
| 14. Testing | Unit + RTL across all phases. Smoke E2E in Task 55. Full E2E suite in Plan 4. |
| 15. CI/CD + branching + deploy | One-time setup in workflow section. GitHub Actions workflow + branch protection in Plan 4. |
| 16. Out of scope | Respected — no backend, no auth, no real uploads. |
| 17. Risks | Material Symbols verification on first render (Task 11). Branch capitalization verification on first push (one-time setup). |

---

## Plan-author notes (out of band)

- After user approves this plan, the plan author will batch-create one Linear issue per task (58 issues total) under the JobTracker project, ordered by task number. Each issue gets:
  - Title: `Task N: <task heading>`
  - Description: link to this plan section + the `Files` line + a copy of the steps.
  - Label: `plan-1-foundation`.
  - Estimate: 1 (XS) for setup tasks, 2 (S) for utils/stores, 3 (M) for UI tasks, 5 (L) for the Card Detail tabs.
  - Project: JobTracker.
- Once issues exist, the plan file gets updated to add `(NNE-XXX)` to each task header.
- Plan 2 will be drafted after Plan 1 is fully merged to `Development`.
