# JobTracker — Plan 3: Research + Profile

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax. Each task maps 1:1 to a Linear issue. **Prerequisite:** Plans 1 and 2 fully merged to `Development`.

**Goal:** Ship the remaining two top-level views: Research and Profile, including Research picks/analytics/LinkedIn/watched-company surfaces and a full Profile workspace with editable About, document managers, preferences, activity, side cards, and reset demo data.

**Architecture:** Extends the Plan 1/2 local-first store and repository boundaries. Research uses immutable seed/discovery data plus functional "Add to wishlist" interactions that create application cards through the existing apps store. Profile uses persisted profile/document state, URL-canonical tab state from Plan 2, and keeps v1 editing scoped to the About field.

**Tech Stack:** No new top-level dependencies. Uses existing Next.js App Router, Zustand persist, Radix UI, react-hook-form, zod, Vitest + RTL, Playwright, Tailwind v4 token utilities, and Material Symbols.

**Spec:** `docs/superpowers/specs/2026-05-08-jobtracker-design.md` — §8.15 Research, §8.16 Profile, §8.17 Demo-only controls, §14 E2E tests #5/#7/#8/#11.

**Style note:** Preserve Plan 1/2 visual language. Functional state changes are limited to Add-to-wishlist, About edit, document default/use metadata, tab URL state, and reset demo data. All external/social/reporting controls are wrapped in `<DemoOnly>`.

---

## Phase A — Profile Store + Seed Completion (Tasks 1–3)

### Task 1: Complete profile domain types and seed exports

**Files:** `src/lib/types.ts`, `src/lib/data/seed.ts`, `tests/unit/profile-seed.test.ts`.

- [ ] **Step 1:** Add the full profile-related types from spec §5 if they are not already present: `Profile`, `ProfileLink`, `SearchPrefs`, `Experience`, `Education`, `Skill`, `Language`, `Cert`, `ProfileCompletenessSection`, `CompanyDetail`, `JobListing`, `DailyPick`.
- [ ] **Step 2:** Port profile, market, LinkedIn, watched-company, daily-pick, job-listing, and company-detail seed constants from `.design-bundle/software-engineer/project/data.js` and `profile-data.js`.
- [ ] **Step 3:** Extend `seedAll()` to return `profile`, `dailyPicks`, `jobListings`, `companyDetails`, `marketSalaries`, `marketSkills`, `linkedinSuggested`, `linkedinInMail`, `linkedinEvents`, and `companiesWatch`.
- [ ] **Step 4:** Test that `seedAll().dailyPicks.length === 6`, `seedAll().jobListings.length === 12`, `seedAll().profile.name === 'You'`, and `seedAll().profile.completeness.sections.length === 8`.
- [ ] **Step 5:** Run `pnpm typecheck && pnpm test:unit`.
- [ ] **Step 6:** Commit `feat(seed): complete profile and research seed data`.

### Task 2: Expand profile store actions

**Files:** `src/lib/store/profile-store.ts`, `tests/unit/store/profile-store.test.ts`.

- [ ] **Step 1:** Store state includes `{ profile, resumes, coverLetters }` initialized from `seedAll()`.
- [ ] **Step 2:** Implement `updateProfile(patch)`, `updateAbout(text)`, `addResume(input)`, `removeResume(id)`, `setDefaultResume(id)`, `editResume(id, patch)`, `incrementResumeUse(id)`, and matching cover-letter actions.
- [ ] **Step 3:** `updateAbout` trims only trailing whitespace, preserves linebreaks, validates max 2000 characters, bumps `profile.updatedAt`, and appends a profile activity/audit history entry through the existing audit/log path.
- [ ] **Step 4:** Tests cover `updateAbout`, `setDefaultResume`, `incrementResumeUse`, `removeResume`, and cover-letter default behavior.
- [ ] **Step 5:** Run `pnpm test:unit tests/unit/store/profile-store.test.ts`.
- [ ] **Step 6:** Commit `feat(store): profile editing and document actions`.

### Task 3: Add research interactions to apps store

**Files:** `src/lib/store/apps-store.ts`, `tests/unit/store/research-actions.test.ts`.

- [ ] **Step 1:** Add `addToWishlist(listingOrPick)` action that creates a wishlist `Application` from a `JobListing` or `DailyPick`, sets `sourceListingId` when available, and returns the new application.
- [ ] **Step 2:** Ensure generated cards use deterministic display IDs in tests and persisted UUIDs in the browser, set `status: 'wishlist'`, `progress: 5`, and append history `"Added to wishlist from Research"` or `"Added to wishlist from Jobs"`.
- [ ] **Step 3:** Tests assert adding `JL-101` creates one wishlist card, preserves company/role/salary/tags, and does not duplicate when the same listing is already tracked.
- [ ] **Step 4:** Run `pnpm test:unit tests/unit/store/research-actions.test.ts`.
- [ ] **Step 5:** Commit `feat(store): add wishlist creation from discovery data`.

---

## Phase B — Research View (Tasks 4–10)

### Task 4: ResearchHero

**Files:** `src/components/research/ResearchHero.tsx`.

- [ ] **Step 1:** Implement the two-card hero from spec §8.15: Daily spotlight and Your search momentum.
- [ ] **Step 2:** "Review picks" scrolls/focuses the daily picks section. "Tune preferences" is wrapped in `<DemoOnly label="Tune preferences">`.
- [ ] **Step 3:** Commit `feat(research): ResearchHero`.

### Task 5: Daily picks and PickCard

**Files:** `src/components/research/DailyPicksSection.tsx`, `src/components/research/PickCard.tsx`, `tests/unit/components/research/PickCard.test.tsx`.

- [ ] **Step 1:** Render the "Today's picks for you" section header and 3-column responsive picks grid from seed daily picks.
- [ ] **Step 2:** `PickCard` shows company logo/link, role, company subline, match score, location, salary, applicants/posted, reason chips, and action row.
- [ ] **Step 3:** "Add to wishlist" calls `useAppsStore.addToWishlist(pick)`, changes that card's action state to "On wishlist", and fires a success toast.
- [ ] **Step 4:** "Open" and dismiss controls are `<DemoOnly>`.
- [ ] **Step 5:** Test clicking "Add to wishlist" creates a wishlist app and renders "On wishlist".
- [ ] **Step 6:** Commit `feat(research): daily picks with wishlist action`.

### Task 6: Pipeline analytics

**Files:** `src/components/research/PipelineKpisSection.tsx`, `tests/unit/components/research/PipelineKpisSection.test.tsx`.

- [ ] **Step 1:** Render the section header and four KPI cards from current applications state: open applications, average time to response, conversion to onsite, offers in flight.
- [ ] **Step 2:** Deltas use fixed demo comparisons from seed and proper up/down/flat icons.
- [ ] **Step 3:** Test computes KPI values from the seeded 14 cards.
- [ ] **Step 4:** Commit `feat(research): pipeline analytics KPIs`.

### Task 7: Market trends

**Files:** `src/components/research/MarketTrendsSection.tsx`.

- [ ] **Step 1:** Implement the two-card grid from spec §8.15: Total comp by level and Skill demand.
- [ ] **Step 2:** Bar heights/widths are computed from seed values and use gold only for highlighted/upward values; down deltas use error color.
- [ ] **Step 3:** "Change role" is `<DemoOnly label="Change market trend role">`.
- [ ] **Step 4:** Commit `feat(research): market trend cards`.

### Task 8: LinkedIn section

**Files:** `src/components/research/LinkedInSection.tsx`.

- [ ] **Step 1:** Render section header with "Demo data — no LinkedIn integration in v1" caption.
- [ ] **Step 2:** Implement People to connect with, Recruiter InMail, and Events near you cards using the ported seed data.
- [ ] **Step 3:** All Connect, Reply, Open LinkedIn, and Find more events controls are `<DemoOnly>` and have `data-demo-only="true"`.
- [ ] **Step 4:** Commit `feat(research): LinkedIn demo section`.

### Task 9: Watched companies

**Files:** `src/components/research/WatchedCompaniesSection.tsx`.

- [ ] **Step 1:** Render watched company cards from seed, including logo, company name, meta line, and count badge.
- [ ] **Step 2:** Each company card links to `/company/<companyId>` so Plan 2's company modal opens.
- [ ] **Step 3:** The dashed "Watch another company" tile is `<DemoOnly label="Watch another company">`.
- [ ] **Step 4:** Commit `feat(research): watched companies grid`.

### Task 10: ResearchView page

**Files:** `src/app/research/page.tsx`, `src/components/research/ResearchView.tsx`, `tests/e2e/research-flow.spec.ts`.

- [ ] **Step 1:** Replace the placeholder page with `ResearchView`, composing Tasks 4–9 in spec order.
- [ ] **Step 2:** E2E: visit `/research`, assert hero, daily picks, market trends, LinkedIn, and watched companies render.
- [ ] **Step 3:** E2E: click Add to wishlist on the Anthropic pick, navigate to `/`, assert a wishlist card exists.
- [ ] **Step 4:** Run `pnpm test:e2e tests/e2e/research-flow.spec.ts`.
- [ ] **Step 5:** Commit `feat(research): compose ResearchView`.

---

## Phase C — Profile View (Tasks 11–18)

### Task 11: ProfileHero

**Files:** `src/components/profile/ProfileHero.tsx`.

- [ ] **Step 1:** Implement the hero from spec §8.16: gradient panel, 80px YO photo, name/pronouns, Open to work pill, headline, meta row, links, and right-side actions.
- [ ] **Step 2:** "Edit profile" scrolls/focuses the About edit control. Share and Settings are `<DemoOnly>`.
- [ ] **Step 3:** Commit `feat(profile): ProfileHero`.

### Task 12: ProfileTabs shell

**Files:** `src/components/profile/ProfileTabs.tsx`, `src/components/profile/ProfileView.tsx`.

- [ ] **Step 1:** Use the `useProfileTab` hook from Plan 2 to read and write `?tab=overview|resumes|covers|preferences|activity`.
- [ ] **Step 2:** Render the five tab triggers and right-aligned completion bar.
- [ ] **Step 3:** `ProfileView` lays out main column plus persistent side column.
- [ ] **Step 4:** Commit `feat(profile): tabbed profile shell`.

### Task 13: Editable About + Overview tab

**Files:** `src/components/profile/tabs/ProfileOverviewTab.tsx`, `tests/unit/components/profile/ProfileOverviewTab.test.tsx`.

- [ ] **Step 1:** Implement About card with read mode and edit mode. Edit mode uses `react-hook-form` + `zod` schema `{ about: z.string().min(1).max(2000) }`.
- [ ] **Step 2:** Save calls `useProfileStore.updateAbout(text)` and exits edit mode. Cancel restores previous text without mutation.
- [ ] **Step 3:** Implement Experience, Education, Skills, Languages, Certifications, and Achievements cards from profile seed.
- [ ] **Step 4:** Add icon buttons for add/edit actions, wrapped in `<DemoOnly>` except the About edit button.
- [ ] **Step 5:** Test save/cancel flows and max-length validation.
- [ ] **Step 6:** Commit `feat(profile): editable overview tab`.

### Task 14: ResumeManager tabs

**Files:** `src/components/profile/ResumeManager.tsx`, `src/components/profile/tabs/ResumesTab.tsx`, `src/components/profile/tabs/CoverLettersTab.tsx`.

- [ ] **Step 1:** `ResumeManager({ kind })` renders rows for resumes or cover letters with icon, name, Default pill, flavor, metadata, keywords where applicable, and Preview/Edit/Duplicate/Delete controls.
- [ ] **Step 2:** "Set default" calls profile store actions. Upload/Preview/Edit/Duplicate/Delete controls are `<DemoOnly>` except Set default.
- [ ] **Step 3:** Resumes tab renders `kind="resume"`; Cover letters tab renders `kind="cover"`.
- [ ] **Step 4:** Commit `feat(profile): resume and cover letter managers`.

### Task 15: Preferences and Activity tabs

**Files:** `src/components/profile/tabs/PreferencesTab.tsx`, `src/components/profile/tabs/ProfileActivityTab.tsx`.

- [ ] **Step 1:** Preferences tab renders target roles, work mode, min comp, notice period, interested industries, and avoided industries from `profile.preferences`.
- [ ] **Step 2:** Activity tab computes summary counts from app activity/history and most-used resume.
- [ ] **Step 3:** Preferences Edit button is `<DemoOnly>`.
- [ ] **Step 4:** Commit `feat(profile): preferences and activity tabs`.

### Task 16: Profile side cards + reset demo data

**Files:** `src/components/profile/side/SnapshotCard.tsx`, `src/components/profile/side/CompletenessCard.tsx`, `src/components/profile/side/WhoViewedCard.tsx`, `src/components/profile/side/ProfileSidePanel.tsx`, `src/components/ui/ConfirmDialog.tsx`.

- [ ] **Step 1:** Snapshot card renders Active / Resumes / Covers / Skills counts.
- [ ] **Step 2:** Completeness card renders check/circle rows and Add links for incomplete sections, with Add links wrapped in `<DemoOnly>`.
- [ ] **Step 3:** Who Viewed card renders three seed/demo viewer rows, "Demo data" caption, and a `<DemoOnly>` See all link.
- [ ] **Step 4:** Reset demo data button opens a confirmation dialog and calls `resetDemoData()` on confirm, then reloads the page.
- [ ] **Step 5:** Commit `feat(profile): side cards and reset demo data`.

### Task 17: Profile page integration

**Files:** `src/app/profile/page.tsx`, `src/components/profile/ProfileView.tsx`, `tests/e2e/profile-flow.spec.ts`.

- [ ] **Step 1:** Replace placeholder page with `ProfileView`.
- [ ] **Step 2:** E2E: visit `/profile`, assert hero and overview render.
- [ ] **Step 3:** E2E: click About edit, change text, save, refresh, assert persisted text remains.
- [ ] **Step 4:** E2E: click Resumes/Cover letters/Preferences/Activity tabs and assert content swaps with URL params.
- [ ] **Step 5:** Run `pnpm test:e2e tests/e2e/profile-flow.spec.ts`.
- [ ] **Step 6:** Commit `feat(profile): compose ProfileView`.

### Task 18: Plan 3 verification checkpoint

**Files:** none.

- [ ] **Step 1:** Run `pnpm lint && pnpm typecheck && pnpm test:unit && pnpm test:e2e && pnpm build`.
- [ ] **Step 2:** Manual walkthrough: Research add-to-wishlist persists, watched company links open company detail, Profile About edit persists, tab deep links refresh correctly, Reset demo data restores seed.
- [ ] **Step 3:** Commit `chore: Plan 3 verification checkpoint`.

---

## What Plan 3 ships

- Research view fully functional with hero, picks, pipeline KPIs, market trends, LinkedIn demo section, and watched companies.
- Add-to-wishlist from Research creates application cards through the same store path used by Jobs.
- Profile view fully functional with all five tabs, editable About, resume/cover managers, preferences/activity, side cards, and reset demo data.
- Profile tab state is URL-canonical and refresh-stable.

## Spec coverage check (Plan 3)

| Spec § | Plan 3 coverage |
| --- | --- |
| 8.15 Research | Tasks 4–10 |
| 8.16 Profile | Tasks 11–17 |
| 8.17 Demo-only controls | Tasks 4, 8, 9, 11, 13–16 |
| §6 Profile tab URL state | Task 12, depends on Plan 2 hook |
| §14 E2E #5 | Task 10 |
| §14 E2E #7 | Task 17 |
| §14 E2E #8 | Task 16 |
| §14 E2E #11 | DemoOnly assertions in Tasks 8, 13, 16 |
