# Research Morning Matches

## Goal

Make the Research tab useful for a single-user job hunt:
- Default the profile/search signals to Nikhil's attached 2026 resume.
- Ensure the daily cron has at least one no-key provider path plus existing keyed providers.
- Rank jobs with stronger resume/job matching than plain keyword substring overlap.
- Merge the completed feature back to `Development`; do not touch `Production`.

## Research Notes

- LinkedIn official jobs APIs are partner-gated and not accepting new Job Posting API partnerships, so direct LinkedIn integration stays out of scope.
- JSearch can aggregate public/Google for Jobs sources and has a free tier, so the existing keyed provider remains useful when credentials are present.
- Remotive offers a public remote-jobs API, with attribution/link-back expectations. For this single-user tracker, preserve apply/source URLs.
- Recent resume/job matching work commonly uses semantic embeddings or TF-IDF/cosine baselines. For this repo, implement a deterministic, dependency-free weighted scorer now: exact skill phrases, aliases, role/seniority, resume keywords, location/remote fit, and recency.

## Steps

1. Add failing tests for default Nikhil search preferences, resume-backed score behavior, Remotive provider mapping, and pipeline query fanout.
2. Implement Nikhil defaults in seed/profile/search data.
3. Add Remotive provider and registry wiring.
4. Replace simple overlap scoring with weighted profile matching while preserving the existing API surface.
5. Adjust cron timing/docs to morning Pacific on Vercel Hobby daily cadence.
6. Run focused tests, typecheck, lint, then merge into `Development`.
