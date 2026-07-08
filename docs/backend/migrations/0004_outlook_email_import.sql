-- JobTracker - Migration 0004: Outlook email import
-- Single-user, service-role-only. The browser never accesses these tables.

create table if not exists public.outlook_connections (
  owner_user_id uuid primary key references public.users (id) on delete cascade,
  email text,
  refresh_token_ciphertext text not null,
  refresh_token_iv text not null,
  refresh_token_tag text not null,
  scope text not null,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.outlook_imported_messages (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.users (id) on delete cascade,
  message_id text not null,
  internet_message_id text,
  application_id uuid references public.applications (id) on delete set null,
  company_name text,
  role text,
  received_at timestamptz,
  imported_at timestamptz not null default now()
);

create unique index if not exists outlook_imported_messages_owner_message_id
  on public.outlook_imported_messages (owner_user_id, message_id);

create unique index if not exists outlook_imported_messages_owner_internet_message_id
  on public.outlook_imported_messages (owner_user_id, internet_message_id)
  where internet_message_id is not null;

alter table public.outlook_connections enable row level security;
alter table public.outlook_imported_messages enable row level security;

-- No anon/authenticated policies: service role only while the app is single-user.
