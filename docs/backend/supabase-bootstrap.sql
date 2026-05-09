-- JobTracker Supabase bootstrap (Milestone 1 schema baseline)
-- Run in Supabase SQL editor, then iterate with migrations.

create extension if not exists "pgcrypto";

create table if not exists public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.users (id) on delete cascade,
  display_id text not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (owner_user_id, display_id)
);

create table if not exists public.application_activity (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.users (id) on delete cascade,
  application_id uuid not null references public.applications (id) on delete cascade,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.app_docs (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.users (id) on delete cascade,
  application_id uuid not null references public.applications (id) on delete cascade,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_user_id, application_id)
);

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null unique references public.users (id) on delete cascade,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.resumes (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.users (id) on delete cascade,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.cover_letters (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.users (id) on delete cascade,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.users (id) on delete cascade,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.users (id) on delete cascade,
  entity_type text not null,
  entity_id text not null,
  event text not null,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_events_owner_created_at
  on public.audit_events (owner_user_id, created_at desc);

create table if not exists public.app_logs (
  id uuid primary key default gen_random_uuid(),
  level text not null,
  message text not null,
  context jsonb,
  created_at timestamptz not null default now()
);

alter table public.users enable row level security;
alter table public.applications enable row level security;
alter table public.application_activity enable row level security;
alter table public.app_docs enable row level security;
alter table public.profiles enable row level security;
alter table public.resumes enable row level security;
alter table public.cover_letters enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_events enable row level security;
alter table public.app_logs enable row level security;

create policy "owner can read users"
  on public.users for select using (id = auth.uid());
create policy "owner can insert users"
  on public.users for insert with check (id = auth.uid());
create policy "owner can update users"
  on public.users for update using (id = auth.uid());

create policy "owner can read applications"
  on public.applications for select using (owner_user_id = auth.uid());
create policy "owner can write applications"
  on public.applications for all using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());

create policy "owner can read application_activity"
  on public.application_activity for select using (owner_user_id = auth.uid());
create policy "owner can write application_activity"
  on public.application_activity for all using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());

create policy "owner can read app_docs"
  on public.app_docs for select using (owner_user_id = auth.uid());
create policy "owner can write app_docs"
  on public.app_docs for all using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());

create policy "owner can read profiles"
  on public.profiles for select using (owner_user_id = auth.uid());
create policy "owner can write profiles"
  on public.profiles for all using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());

create policy "owner can read resumes"
  on public.resumes for select using (owner_user_id = auth.uid());
create policy "owner can write resumes"
  on public.resumes for all using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());

create policy "owner can read cover_letters"
  on public.cover_letters for select using (owner_user_id = auth.uid());
create policy "owner can write cover_letters"
  on public.cover_letters for all using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());

create policy "owner can read notifications"
  on public.notifications for select using (owner_user_id = auth.uid());
create policy "owner can write notifications"
  on public.notifications for all using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());

create policy "owner can read audit_events"
  on public.audit_events for select using (owner_user_id = auth.uid());
create policy "owner can write audit_events"
  on public.audit_events for all using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());

-- Service role only.
create policy "service role only app_logs"
  on public.app_logs for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
