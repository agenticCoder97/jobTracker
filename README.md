# JobTrack

Local-first job application tracker built with Next.js 15, TypeScript, Tailwind v4 tokens, Zustand persistence, Vitest, and Playwright.

## Status

- **Plan 1 — Foundation, Board, Card Detail:** ✅ Implemented (TopBar, Board, dnd-kit drag/drop, Card Detail modal with six tabs, persisted Zustand stores with versioned migrations, hydrated SSR-safe).
- **Plan 2 — Jobs, Companies, Apply:** ✅ Implemented (URL-canonical filters, Job Listing Preview modal, Companies grid + Company Detail modal, Resume Picker apply flow).
- **Plan 3 — Research, Profile:** ✅ Implemented (Research view with Daily Picks + KPIs + Market trends + LinkedIn signals + Watched companies; Profile with Hero + tabs + About inline-edit + Resume manager + Confirmation dialog for reset).
- **Plan 4 — CI/CD, tests, polish:** ✅ Shipped (GitHub Actions CI + E2E, branch protection docs, Playwright stability config, audit-event repository, error boundary, Supabase migration roadmap, build report, release checklist).

Plans live in `docs/superpowers/plans/`. The source design spec is `docs/superpowers/specs/2026-05-08-jobtracker-design.md`.

## Deployment & operations

- `docs/deployment/branching-and-vercel.md` — branch model, Vercel config, CI overview, local commands.
- `docs/deployment/github-branch-protection.md` — exact protection rules per branch and the Patch hotfix flow.
- `docs/deployment/build-report.md` — route sizes from the latest production build.
- `docs/deployment/release-checklist.md` — pre-merge / merge / rollback steps.
- `docs/backend/supabase-roadmap.md` — repository contract and milestones for the future Supabase adapter.

## Runtime limitations (v1)

- Single-user, localStorage-only. Clearing browser storage wipes everything.
- Glassdoor / LinkedIn / Who-viewed / Recruiter-InMail surfaces are seeded demo data — every demo control is wrapped in `<DemoOnly>` and shows a tooltip + toast on interaction.
- StatusPill and PriorityPill on the card detail header are read-only display chips; status changes happen via drag/drop on the board.

## Local Development

```bash
corepack pnpm install
corepack pnpm dev
```

Open `http://localhost:3000`.

## Verification

```bash
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test:unit
corepack pnpm test:e2e
corepack pnpm build
```

Install Playwright Chromium if needed:

```bash
corepack pnpm exec playwright install chromium
```

## Branch Model

- `main`: initial/default branch.
- `Development`: integration branch for preview deploys.
- `Production`: production deploy branch.
- `Patch`: hotfix branch off `Production`.

The current runtime is local-only. No Supabase credentials or backend services are required.
