# JobTrack

Local-first job application tracker built with Next.js 15, TypeScript, Tailwind v4 tokens, Zustand persistence, Vitest, and Playwright.

## Status

- **Plan 1 implemented:** scaffold, tokens, typed seed data, persisted stores, TopBar, Board, dnd-kit drag/drop, Card Detail modal with six tabs, and smoke tests.
- **Plan 2 planned:** Jobs, Companies, company/listing modals, and Apply flow.
- **Plan 3 planned:** Research and Profile.
- **Plan 4 planned:** CI/CD, full E2E suite, demo-data polish, audit/log plumbing, accessibility, and release handoff.

Plans live in `docs/superpowers/plans/`. The source design spec is `docs/superpowers/specs/2026-05-08-jobtracker-design.md`.

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
