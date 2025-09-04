-- Extensions (for UUIDs if needed)
create extension if not exists "pgcrypto";

-- assessments table
create table if not exists public.assessments (
  id uuid primary key default gen_random_uuid(),
  dealer_id text not null,
  answers jsonb not null,
  risk text not null check (risk in ('low','medium','high')),
  reasoning text,
  created_at timestamp with time zone default now()
);

-- assessment events
create table if not exists public.assessment_events (
  id uuid primary key default gen_random_uuid(),
  dealer_id text not null,
  event_type text not null check (event_type in ('scanned','started','completed')),
  created_at timestamp with time zone default now()
);

-- custom questions
create table if not exists public.custom_questions (
  id uuid primary key default gen_random_uuid(),
  dealer_id text not null,
  question text not null,
  created_at timestamp with time zone default now()
);

-- dealer settings
create table if not exists public.dealer_settings (
  dealer_id text primary key,
  logo_url text,
  theme_color text default '#1E3A8A',
  contact_email text,
  created_at timestamp with time zone default now()
);

-- Row Level Security
alter table public.assessments enable row level security;
alter table public.assessment_events enable row level security;
alter table public.custom_questions enable row level security;
alter table public.dealer_settings enable row level security;

-- RLS Policies (read/write own rows by dealer_id via supabaseAdmin on server or anon with eq dealer_id)
-- For server routes using service role, RLS is bypassed (OK). For client inserts, create permissive policies if desired.

-- Example: allow read assessments by dealer_id (if using anon client on dashboard, filtered server-side is safer)
create policy "read own assessments"
on public.assessments for select
using (true);

create policy "insert assessments (public via server)"
on public.assessments for insert
with check (true);

create policy "read events"
on public.assessment_events for select
using (true);

create policy "insert events"
on public.assessment_events for insert
with check (true);

create policy "read custom questions"
on public.custom_questions for select
using (true);

create policy "modify custom questions"
on public.custom_questions for all
using (true)
with check (true);

create policy "read dealer settings"
on public.dealer_settings for select
using (true);

create policy "upsert dealer settings"
on public.dealer_settings for all
using (true)
with check (true);
