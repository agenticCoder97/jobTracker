# Branching, CI, and Vercel deployment

## Branch roles

| Branch | Purpose | Typical PR source |
| --- | --- | --- |
| `main` | Initial scaffold and historical archive. Untouched after the first commit; receives no day-to-day changes. | none |
| `Development` | Integration target. All feature work merges here first. Vercel produces a per-PR preview, plus a fresh preview on every push. | feature branches |
| `Production` | Live site. Vercel's "Production Branch" is set to this. Only fast-forward merges from `Development` or `Patch`. | `Development`, `Patch` |
| `Patch` | Hotfixes that must skip integration. Branch from `Production`, fix, PR back to `Production`, then immediately merge `Production` back into `Development` to avoid drift. | branched from `Production` |

## Vercel configuration

- Project linked to GitHub repository at the org level.
- **Production Branch**: `Production`.
- **Preview Branches**: all branches and all PRs (default).
- **Framework preset**: Next.js.
- **Install Command**: `corepack enable && pnpm install --frozen-lockfile`.
- **Build Command**: `pnpm build` (Next.js default).
- **Output Directory**: leave default; Next.js detects `.next/`.
- **Required environment variables**: none. The local-storage adapter is the v1 default; no Supabase or third-party keys are needed for the app to boot or render.
- **Optional production/preview env vars**: `NEXT_PUBLIC_LOGO_DEV_TOKEN` overrides the bundled Logo.dev publishable key. Company logos fall back to Simple Icons CDN and then the local initial tile when a Logo.dev image is unavailable.
- **Optional env vars (future Supabase milestone)**: `NEXT_PUBLIC_PERSISTENCE_ADAPTER`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`. See `docs/backend/supabase-roadmap.md`.

## CI pipeline

GitHub Actions workflows live in `.github/workflows/`:

- `ci.yml` — runs on PRs and pushes to `Development`, `Production`, `Patch`, `main`. Steps: install (frozen lockfile) → `pnpm lint` → `pnpm typecheck` → `pnpm test:unit` → `pnpm build`. Coverage artifacts are uploaded if produced.
- `e2e.yml` — runs on PRs targeting `Production`, on manual dispatch, and on a weekday-morning cron. Installs Playwright Chromium, runs `pnpm test:e2e`, and uploads HTML reports + raw `test-results/` for both pass and fail.

## Local commands

```sh
corepack pnpm install      # install dependencies
corepack pnpm dev          # start Next.js dev server (http://localhost:3000)
corepack pnpm lint         # ESLint
corepack pnpm typecheck    # tsc --noEmit
corepack pnpm test:unit    # Vitest
corepack pnpm test:e2e     # Playwright (boots dev server)
corepack pnpm build        # production build
corepack pnpm format       # Prettier write
```

`corepack` is shipped with Node ≥20 and selects the correct pnpm version from `package.json`'s `packageManager` field, so contributors do not need to install pnpm globally.

## Where things go wrong (and how to fix)

- **Lockfile drift breaks CI install** — never run `pnpm install` without committing the resulting `pnpm-lock.yaml`. CI uses `--frozen-lockfile`.
- **Local build OK, Vercel build fails** — usually a missing env var. The local adapter requires none; if you added one, set it in the Vercel project's Environment Variables section before merging.
- **Playwright flake on CI but green locally** — CI uses retries (`retries: 2`) and traces (`on-first-retry`); inspect the uploaded `playwright-report` artifact for the actual failure rather than re-running.
