-- 001_init.sql

-- Extensions
create extension if not exists "pgcrypto";

-- DEALERS (one row per dealer account)
create table if not exists public.dealers (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid unique, -- maps to auth.users.id
  name text,
  email text,
  is_active boolean not null default true
);

-- ASSESSMENTS (one row per customer assessment)
create table if not exists public.assessments (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  dealer_id uuid references public.dealers(id) on delete set null,
  customer_name text,
  customer_phone text,
  status text not null default 'started', -- started|completed
  flow text not null default 'standard', -- standard|ai
  answers jsonb not null default '[]'::jsonb, -- [{role,content,ts}...] or QA list
  risk_score text, -- low|medium|high
  reasoning text
);

-- CUSTOM QUESTIONS (dealer-defined questions)
create table if not exists public.custom_questions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  dealer_id uuid not null references public.dealers(id) on delete cascade,
  question text not null,
  is_active boolean not null default true,
  sort_order int not null default 100
);

-- Helpful indexes
create index if not exists idx_assessments_dealer_id on public.assessments(dealer_id);
create index if not exists idx_custom_questions_dealer_id on public.custom_questions(dealer_id);

-- NOTES:
-- If you already have tables, you may need ALTER TABLE instead.
-- If "assessments" exists but is missing columns:
-- alter table public.assessments add column if not exists flow text not null default 'standard';
-- alter table public.assessments add column if not exists answers jsonb not null default '[]'::jsonb;
-- alter table public.assessments add column if not exists customer_name text;
-- alter table public.assessments add column if not exists customer_phone text;
-- alter table public.assessments add column if not exists risk_score text;
-- alter table public.assessments add column if not exists reasoning text;
