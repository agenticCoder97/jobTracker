# GitHub branch protection checklist

Apply via **Settings → Branches → Branch protection rules** in the GitHub repository. Each section below corresponds to one rule.

## Rule for `Development`

- **Branch name pattern**: `Development`
- ✅ Require a pull request before merging
  - Required approvals: 0 (single-maintainer repo) or 1 (if collaborators are added)
  - ✅ Dismiss stale pull request approvals when new commits are pushed
- ✅ Require status checks to pass before merging
  - ✅ Require branches to be up to date before merging
  - Required check: `CI / Lint · Typecheck · Unit · Build`
- ✅ Require conversation resolution before merging
- ✅ Allow administrators to bypass — for emergency recovery only; document any bypass in the PR description

## Rule for `Production`

- **Branch name pattern**: `Production`
- ✅ Require a pull request before merging
  - PRs may originate only from `Development` or `Patch`
  - Required approvals: 1
  - ✅ Dismiss stale pull request approvals when new commits are pushed
- ✅ Require status checks to pass before merging
  - ✅ Require branches to be up to date before merging
  - Required checks:
    - `CI / Lint · Typecheck · Unit · Build`
    - `E2E / Playwright (Chromium)`
- ✅ Require conversation resolution before merging
- ✅ Require linear history
- ✅ Restrict who can push (allow none — only PRs)
- ✅ Restrict force-pushes (block all)
- ❌ Do **not** allow administrator bypass

## Rule for `main`

- **Branch name pattern**: `main`
- ✅ Restrict force-pushes
- ✅ Restrict deletions
- No PR / status-check requirements (the branch is archival).

## `Patch` hotfix procedure

1. Branch from `Production`: `git checkout -b Patch/<short-name> Production`.
2. Implement and commit the fix on the patch branch.
3. Open a PR **from `Patch/<short-name>` to `Production`**. CI + E2E must pass.
4. Squash-merge into `Production`. Vercel deploys to production automatically.
5. Immediately open a follow-up PR **from `Production` to `Development`** (merge commit) to keep `Development` in sync. This prevents the patch from being silently undone in the next `Development` → `Production` PR.
6. Delete the `Patch/<short-name>` branch after both merges land.

## Verification

After applying, attempt:

- A direct push to `Production` — must be rejected.
- A PR from a topic branch directly to `Production` — must be blocked unless the topic branch name starts with `Patch/`.
- Merging a PR with failing CI — must be blocked.
