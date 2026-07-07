-- JobTracker — Migration 0003: research tables (single-user, trimmed)
-- Scope: external_jobs, external_companies, watched_companies, dismissed_picks,
--        api_call_log, cron_runs. No RBAC / api_providers / quota (deferred).
-- provider columns are plain text; the ProviderId union validates them app-side.
-- Single-user, no auth: the client never connects, so these tables are
-- service-role-only. RLS is enabled with NO anon/authenticated policies, which
-- denies all client access by default while the service role bypasses RLS.

create extension if not exists pgcrypto;

create table if not exists public.external_jobs (
  id uuid primary key default gen_random_uuid(),
  source_provider text not null,
  source_id text not null,
  payload jsonb not null,
  fetched_at timestamptz not null default now(),
  expires_at timestamptz,
  unique (source_provider, source_id)
);
create index if not exists idx_external_jobs_fetched_at
  on public.external_jobs (fetched_at desc);

create table if not exists public.external_companies (
  id uuid primary key default gen_random_uuid(),
  source_provider text not null,
  source_id text not null,
  payload jsonb not null,
  fetched_at timestamptz not null default now(),
  expires_at timestamptz,
  unique (source_provider, source_id)
);

create table if not exists public.watched_companies (
  owner_user_id uuid not null references public.users (id) on delete cascade,
  company_key text not null,
  added_at timestamptz not null default now(),
  primary key (owner_user_id, company_key)
);

-- external_job_id is the synthetic "provider:sourceId" key the client holds
-- (text, not a uuid FK) so the dismiss action works without a server round-trip
-- to resolve the real row id.
create table if not exists public.dismissed_picks (
  owner_user_id uuid not null references public.users (id) on delete cascade,
  external_job_id text not null,
  dismissed_at timestamptz not null default now(),
  primary key (owner_user_id, external_job_id)
);

create table if not exists public.api_call_log (
  id uuid primary key default gen_random_uuid(),
  provider_id text not null,
  request_path text not null,
  http_status integer,
  latency_ms integer,
  ratelimit_remaining integer,
  owner_user_id uuid references public.users (id) on delete set null,
  error text,
  created_at timestamptz not null default now()
);
create index if not exists idx_api_call_log_provider_created
  on public.api_call_log (provider_id, created_at desc);

create table if not exists public.cron_runs (
  id uuid primary key default gen_random_uuid(),
  job_id text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running' check (status in ('running', 'ok', 'error')),
  items_processed integer not null default 0,
  error text
);
create index if not exists idx_cron_runs_job_started
  on public.cron_runs (job_id, started_at desc);

-- RLS: enable everywhere, add owner-scoped policies only for the two
-- user-owned tables (harmless today since the client never connects, but
-- correct-by-construction for when auth lands). The external_*, api_call_log,
-- and cron_runs tables get NO policies -> service-role-only.
alter table public.external_jobs      enable row level security;
alter table public.external_companies enable row level security;
alter table public.watched_companies  enable row level security;
alter table public.dismissed_picks    enable row level security;
alter table public.api_call_log       enable row level security;
alter table public.cron_runs          enable row level security;

create policy "own watched_companies" on public.watched_companies
  for all using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());
create policy "own dismissed_picks" on public.dismissed_picks
  for all using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());
