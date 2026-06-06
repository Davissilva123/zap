-- =============================================
-- ZapMenu v2 – Execute no Supabase SQL Editor
-- =============================================

-- Cupons de desconto
create table if not exists coupons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  code text not null,
  discount_type text not null default 'percent',
  discount_value numeric not null default 10,
  min_order numeric not null default 0,
  max_uses int,
  uses_count int not null default 0,
  active boolean not null default true,
  expires_at timestamptz,
  created_at timestamptz default now(),
  unique(user_id, code)
);
alter table coupons enable row level security;
drop policy if exists "owner_manage_coupons" on coupons;
create policy "owner_manage_coupons" on coupons for all using (auth.uid() = user_id);
drop policy if exists "public_read_coupons" on coupons;
create policy "public_read_coupons" on coupons for select using (active = true);

-- Novos campos nos pedidos
alter table orders add column if not exists coupon_code text;
alter table orders add column if not exists discount numeric not null default 0;
alter table orders add column if not exists rating int check (rating between 1 and 5);
alter table orders add column if not exists rating_comment text;
alter table orders add column if not exists table_name text;

-- Mesas / Comandas
create table if not exists restaurant_tables (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  "order" int not null default 0,
  active boolean not null default true,
  created_at timestamptz default now()
);
alter table restaurant_tables enable row level security;
drop policy if exists "owner_manage_tables" on restaurant_tables;
create policy "owner_manage_tables" on restaurant_tables for all using (auth.uid() = user_id);
drop policy if exists "public_read_tables" on restaurant_tables;
create policy "public_read_tables" on restaurant_tables for select using (active = true);

-- Operadores
create table if not exists operators (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade not null,
  email text not null,
  name text not null,
  role text not null default 'waiter',
  active boolean not null default true,
  notes text default '',
  created_at timestamptz default now(),
  unique(owner_id, email)
);
alter table operators enable row level security;
drop policy if exists "owner_manage_operators" on operators;
create policy "owner_manage_operators" on operators for all using (auth.uid() = owner_id);
