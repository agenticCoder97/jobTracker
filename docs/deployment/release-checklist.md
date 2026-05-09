# Release checklist

Use this checklist before merging `Development` → `Production`.

## Pre-merge

- [ ] CI green on the PR: `Lint`, `Typecheck`, `Unit`, `Build`.
- [ ] E2E green on the PR (`E2E` workflow runs automatically for PRs targeting `Production`).
- [ ] Vercel preview URL renders all five top-level views (`/`, `/jobs`, `/companies`, `/research`, `/profile`) with no console errors.
- [ ] Modal deep links work on the preview: `/card/JT-34`, `/company/stripe`, `/listing/JL-101`, `/apply/JT-42`.
- [ ] Reset demo data → state returns to seed; refresh keeps the seed.
- [ ] Apply flow on a wishlist card moves it to Applied and increments the chosen resume's usage count.
- [ ] DemoOnly tooltip appears on hover; click fires the spec-canonical toast and does not navigate.
- [ ] No `.env` keys required for the local adapter — Vercel's "Required Environment Variables" UI is empty.
- [ ] PR description includes a 1-line scope summary and the Vercel preview URL.

## Merge

- [ ] Use **squash merge** if Production protection requires linear history (default in this repo).
- [ ] Confirm production deploy succeeds in Vercel (check Deployments tab; status `Ready`).
- [ ] Smoke-test the production URL same as the preview check above.

## Post-merge

- [ ] Tag the production commit if releasing a versioned milestone (`v0.1.0`, etc.).
- [ ] Open follow-up issues for any "deferred to future plan" items surfaced during the PR (track decomposition of `JobTrackerApp.tsx`, Supabase migration milestones).

## Rollback procedure

1. In Vercel **Deployments**, find the previous successful production deployment and click **Promote to Production**. Vercel cuts traffic to the older build immediately; no GitHub action required.
2. In GitHub, revert the offending commit on `Production`:
   ```sh
   git checkout Production
   git revert <commit-sha>
   git push origin Production
   ```
   The revert PR triggers CI/E2E; once green, merge to keep the branch in sync with the live build.
3. Cherry-pick the revert into `Development` (`git cherry-pick <revert-sha>`) so the bad commit doesn't re-enter the integration branch.
4. Open a Patch branch (see `docs/deployment/github-branch-protection.md` "Patch hotfix procedure") for the fix.

## Patch hotfix shortcut

Hotfixes that must skip integration:

```sh
git checkout -b Patch/<short-name> Production
# ... fix ...
git push -u origin Patch/<short-name>
gh pr create --base Production --head Patch/<short-name> --title "patch: <short-description>"
```

After merging to `Production`, immediately open a follow-up PR `Production` → `Development` so the patch reaches integration.

## Known v1 limitations (must be in release notes)

- Persistence is localStorage-only; clearing browser data wipes everything. Multi-device sync requires the Supabase milestone (see `docs/backend/supabase-roadmap.md`).
- Glassdoor / Who-viewed / Recruiter-InMail / LinkedIn / market-trends data is seeded demo data, not live integrations. Each surface is labelled "Demo data" or wrapped in `<DemoOnly>`.
- Single-user mode: all data attributed to a hard-coded `DEMO_USER_ID`. Real auth lands with Supabase.
- StatusPill / PriorityPill on the card detail header are read-only display chips in v1; status changes happen via drag/drop on the board.
- `JobTrackerApp.tsx` is intentionally consolidated; decomposition into `topbar/`, `board/`, `card-detail/` directories is queued as a refactor follow-up (see `docs/deployment/build-report.md`).
