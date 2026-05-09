-- JobTracker — Migration 0002
-- Adds: RBAC, API integration, research/scraping, analytics, cron tracking.
-- Status: TEMPLATE — review before running. Idempotent (uses IF NOT EXISTS).
-- Apply via Supabase SQL editor or `supabase db push` once the schema is approved.

-- ─────────────────────────────────────────────────────────────
-- 0. Hygiene fix flagged by the security advisor
-- ─────────────────────────────────────────────────────────────
revoke execute on function public.rls_auto_enable() from anon, authenticated, public;

-- ─────────────────────────────────────────────────────────────
-- 1. RBAC
-- ─────────────────────────────────────────────────────────────
create table if not exists public.roles (
  id text primary key,
  label text not null,
  description text
);

create table if not exists public.permissions (
  id text primary key,
  label text not null
);

create table if not exists public.role_permissions (
  role_id text not null references public.roles (id) on delete cascade,
  permission_id text not null references public.permissions (id) on delete cascade,
  primary key (role_id, permission_id)
);

create table if not exists public.user_roles (
  user_id uuid not null references public.users (id) on delete cascade,
  role_id text not null references public.roles (id) on delete cascade,
  granted_at timestamptz not null default now(),
  primary key (user_id, role_id)
);

insert into public.roles (id, label, description) values
  ('admin',  'Administrator', 'Full access; can read all data, manage providers and credentials.'),
  ('user',   'User',          'Default role for end users. Owns their own rows.'),
  ('system', 'System',        'Reserved for service-role/cron jobs. Not assignable to users.')
on conflict (id) do nothing;

insert into public.permissions (id, label) values
  ('research:read',          'Read research data'),
  ('research:write',         'Create/edit research subscriptions'),
  ('admin:read_all',         'Read all owners'' data'),
  ('admin:manage_providers', 'Edit api_providers + api_credentials')
on conflict (id) do nothing;

insert into public.role_permissions (role_id, permission_id) values
  ('user',  'research:read'),
  ('user',  'research:write'),
  ('admin', 'research:read'),
  ('admin', 'research:write'),
  ('admin', 'admin:read_all'),
  ('admin', 'admin:manage_providers')
on conflict do nothing;

create or replace function public.user_has_role(uid uuid, role text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = uid and role_id = role
  );
$$;

revoke execute on function public.user_has_role(uuid, text) from public, anon;
grant execute on function public.user_has_role(uuid, text) to authenticated, service_role;

-- ─────────────────────────────────────────────────────────────
-- 2. API integration
-- ─────────────────────────────────────────────────────────────
create table if not exists public.api_providers (
  id text primary key,
  name text not null,
  kind text not null check (kind in ('jobs', 'company', 'logo', 'salary', 'other')),
  base_url text not null,
  auth_kind text not null check (auth_kind in ('none', 'api_key', 'bearer', 'basic', 'oauth2')),
  enabled boolean not null default false,
  rate_limit_per_min integer,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.api_credentials (
  provider_id text not null references public.api_providers (id) on delete cascade,
  key_name text not null,
  value_enc text not null,                 -- ciphertext (pgsodium / pgcrypto)
  created_at timestamptz not null default now(),
  primary key (provider_id, key_name)
);

create table if not exists public.api_call_log (
  id uuid primary key default gen_random_uuid(),
  provider_id text not null references public.api_providers (id) on delete cascade,
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

create table if not exists public.api_quota (
  provider_id text not null references public.api_providers (id) on delete cascade,
  window_started_at timestamptz not null,
  count integer not null default 0,
  call_limit integer not null,
  primary key (provider_id, window_started_at)
);

-- Seed a few well-known provider rows (disabled by default).
insert into public.api_providers (id, name, kind, base_url, auth_kind, enabled, notes) values
  ('adzuna',        'Adzuna',         'jobs',    'https://api.adzuna.com/v1/api',         'api_key', false, 'Free tier; needs app_id + app_key.'),
  ('themuse',       'The Muse',       'jobs',    'https://www.themuse.com/api/public',    'none',    false, 'No auth; per-company opt-in.'),
  ('jsearch',       'JSearch',        'jobs',    'https://jsearch.p.rapidapi.com',        'api_key', false, 'RapidAPI key; aggregates LinkedIn/Indeed/Glassdoor data lawfully.'),
  ('clearbit_logo', 'Clearbit Logos', 'logo',    'https://logo.clearbit.com',             'none',    false, 'Public logo CDN; pass company domain.'),
  ('linkedin',      'LinkedIn',       'jobs',    'https://api.linkedin.com/v2',           'oauth2',  false, 'Requires Talent Solutions partner approval. Stub only.'),
  ('glassdoor',     'Glassdoor',      'company', 'https://api.glassdoor.com',             'oauth2',  false, 'Public API deprecated 2021. Stub only.')
on conflict (id) do nothing;

-- ─────────────────────────────────────────────────────────────
-- 3. Research data
-- ─────────────────────────────────────────────────────────────
create table if not exists public.external_companies (
  id uuid primary key default gen_random_uuid(),
  source_provider text not null references public.api_providers (id) on delete cascade,
  source_id text not null,
  payload jsonb not null,
  fetched_at timestamptz not null default now(),
  expires_at timestamptz,
  unique (source_provider, source_id)
);

create table if not exists public.external_jobs (
  id uuid primary key default gen_random_uuid(),
  source_provider text not null references public.api_providers (id) on delete cascade,
  source_id text not null,
  payload jsonb not null,
  fetched_at timestamptz not null default now(),
  expires_at timestamptz,
  unique (source_provider, source_id)
);

create index if not exists idx_external_jobs_fetched_at
  on public.external_jobs (fetched_at desc);

create table if not exists public.research_subscriptions (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.users (id) on delete cascade,
  query jsonb not null,
  cadence_cron text not null default '0 */6 * * *',
  enabled boolean not null default true,
  last_run_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.research_results (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.research_subscriptions (id) on delete cascade,
  external_job_id uuid not null references public.external_jobs (id) on delete cascade,
  owner_user_id uuid not null references public.users (id) on delete cascade,
  score numeric(5,2) not null,
  matched_at timestamptz not null default now(),
  unique (subscription_id, external_job_id)
);

create index if not exists idx_research_results_owner_score
  on public.research_results (owner_user_id, score desc, matched_at desc);

create table if not exists public.watched_companies (
  owner_user_id uuid not null references public.users (id) on delete cascade,
  company_key text not null,
  added_at timestamptz not null default now(),
  primary key (owner_user_id, company_key)
);

-- ─────────────────────────────────────────────────────────────
-- 4. Analytics
-- ─────────────────────────────────────────────────────────────
create table if not exists public.user_actions (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references public.users (id) on delete set null,
  kind text not null,
  target text,
  metadata jsonb,
  occurred_at timestamptz not null default now()
);

create index if not exists idx_user_actions_owner_time
  on public.user_actions (owner_user_id, occurred_at desc);

-- ─────────────────────────────────────────────────────────────
-- 5. Cron tracking
-- ─────────────────────────────────────────────────────────────
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

-- ─────────────────────────────────────────────────────────────
-- 6. RLS
-- ─────────────────────────────────────────────────────────────
alter table public.roles                  enable row level security;
alter table public.permissions            enable row level security;
alter table public.role_permissions       enable row level security;
alter table public.user_roles             enable row level security;
alter table public.api_providers          enable row level security;
alter table public.api_credentials        enable row level security;
alter table public.api_call_log           enable row level security;
alter table public.api_quota              enable row level security;
alter table public.external_companies     enable row level security;
alter table public.external_jobs          enable row level security;
alter table public.research_subscriptions enable row level security;
alter table public.research_results       enable row level security;
alter table public.watched_companies      enable row level security;
alter table public.user_actions           enable row level security;
alter table public.cron_runs              enable row level security;

-- Reference data — readable by signed-in users, writeable by admin only.
create policy "auth read roles" on public.roles
  for select using (auth.role() = 'authenticated');
create policy "auth read permissions" on public.permissions
  for select using (auth.role() = 'authenticated');
create policy "auth read role_permissions" on public.role_permissions
  for select using (auth.role() = 'authenticated');

-- user_roles: each user reads their own; admin reads all.
create policy "self read user_roles" on public.user_roles
  for select using (user_id = auth.uid() or public.user_has_role(auth.uid(), 'admin'));
create policy "admin write user_roles" on public.user_roles
  for all using (public.user_has_role(auth.uid(), 'admin'))
  with check (public.user_has_role(auth.uid(), 'admin'));

-- api_providers / api_quota: admin-readable; service_role writes.
create policy "admin read api_providers" on public.api_providers
  for select using (public.user_has_role(auth.uid(), 'admin'));
create policy "admin read api_quota" on public.api_quota
  for select using (public.user_has_role(auth.uid(), 'admin'));

-- api_credentials: NO client-side access. Service role only (no policy = no access).
-- (RLS on with no policy = deny all to non-service-role.)

-- api_call_log: owner sees their own rows; admin sees all.
create policy "owner read api_call_log" on public.api_call_log
  for select using (
    owner_user_id = auth.uid()
    or public.user_has_role(auth.uid(), 'admin')
  );

-- external_* tables: cached public data, readable by any authenticated user.
create policy "auth read external_companies" on public.external_companies
  for select using (auth.role() = 'authenticated');
create policy "auth read external_jobs" on public.external_jobs
  for select using (auth.role() = 'authenticated');

-- research_subscriptions / results / watched_companies: owner or admin.
create policy "owner all research_subscriptions" on public.research_subscriptions
  for all
  using (owner_user_id = auth.uid() or public.user_has_role(auth.uid(), 'admin'))
  with check (owner_user_id = auth.uid() or public.user_has_role(auth.uid(), 'admin'));
create policy "owner all research_results" on public.research_results
  for all
  using (owner_user_id = auth.uid() or public.user_has_role(auth.uid(), 'admin'))
  with check (owner_user_id = auth.uid() or public.user_has_role(auth.uid(), 'admin'));
create policy "owner all watched_companies" on public.watched_companies
  for all
  using (owner_user_id = auth.uid() or public.user_has_role(auth.uid(), 'admin'))
  with check (owner_user_id = auth.uid() or public.user_has_role(auth.uid(), 'admin'));

-- user_actions: owner reads own; admin reads all; insert only by service_role
-- (client emits via a server action that runs under service_role).
create policy "owner read user_actions" on public.user_actions
  for select using (
    owner_user_id = auth.uid()
    or public.user_has_role(auth.uid(), 'admin')
  );

-- cron_runs: admin read; service_role write.
create policy "admin read cron_runs" on public.cron_runs
  for select using (public.user_has_role(auth.uid(), 'admin'));

-- ─────────────────────────────────────────────────────────────
-- 7. Admin override on existing v1 tables
-- ─────────────────────────────────────────────────────────────
-- Existing policies enforce owner-only. Add admin read so the admin role can
-- audit cross-owner without bypassing RLS via the service role.
create policy "admin read applications" on public.applications
  for select using (public.user_has_role(auth.uid(), 'admin'));
create policy "admin read application_activity" on public.application_activity
  for select using (public.user_has_role(auth.uid(), 'admin'));
create policy "admin read app_docs" on public.app_docs
  for select using (public.user_has_role(auth.uid(), 'admin'));
create policy "admin read profiles" on public.profiles
  for select using (public.user_has_role(auth.uid(), 'admin'));
create policy "admin read resumes" on public.resumes
  for select using (public.user_has_role(auth.uid(), 'admin'));
create policy "admin read cover_letters" on public.cover_letters
  for select using (public.user_has_role(auth.uid(), 'admin'));
create policy "admin read notifications" on public.notifications
  for select using (public.user_has_role(auth.uid(), 'admin'));
create policy "admin read audit_events" on public.audit_events
  for select using (public.user_has_role(auth.uid(), 'admin'));
