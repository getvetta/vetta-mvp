-- 001_init.sql
-- Initial schema for Vetta MVP

-- Enable uuid-ossp extension for UUID generation
create extension if not exists "uuid-ossp";

-- Dealers table: stores dealer info
create table if not exists dealers (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  email text not null unique,
  created_at timestamptz not null default now()
);

-- Customers table (optional, for future extension)
create table if not exists customers (
  id uuid primary key default uuid_generate_v4(),
  dealer_id uuid references dealers(id) on delete cascade,
  name text not null,
  phone text,
  email text,
  created_at timestamptz not null default now()
);

-- Assessments table: stores assessment answers and risk results
create table if not exists assessments (
  id uuid primary key default uuid_generate_v4(),
  dealer_id uuid references dealers(id) on delete cascade not null,
  customer_id uuid references customers(id) on delete set null,
  answers jsonb not null,
  risk_score text not null, -- low, medium, high
  explanation text,
  created_at timestamptz not null default now()
);

-- Dealer Analytics table: tracks scans, starts, completions, drop-offs per dealer
create table if not exists dealer_analytics (
  id uuid primary key default uuid_generate_v4(),
  dealer_id uuid references dealers(id) on delete cascade not null,
  event_type text not null check (event_type in ('scan', 'start', 'completion', 'dropoff')),
  event_count int not null default 1,
  created_at timestamptz not null default now()
);

-- Policies for dealers table: only allow dealers to view their own data
create policy "Allow dealers to select own data" on dealers
  for select using (auth.uid() = id);

-- Policies for assessments: dealers only see their assessments
create policy "Allow dealers to select their assessments" on assessments
  for select using (dealer_id = auth.uid());

create policy "Allow dealers to insert assessments" on assessments
  for insert with check (dealer_id = auth.uid());

-- Policies for dealer_analytics: dealers only see their own analytics
create policy "Allow dealers to select their analytics" on dealer_analytics
  for select using (dealer_id = auth.uid());

create policy "Allow dealers to insert analytics" on dealer_analytics
  for insert with check (dealer_id = auth.uid());

-- Enable row level security on tables
alter table dealers enable row level security;
alter table assessments enable row level security;
alter table dealer_analytics enable row level security;
alter table customers enable row level security;

-- Optional: policies for customers table (similar to dealers)
create policy "Allow dealers to select their customers" on customers
  for select using (dealer_id = auth.uid());

create policy "Allow dealers to insert customers" on customers
  for insert with check (dealer_id = auth.uid());
