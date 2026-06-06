-- ============================================================
-- NOVAS FEATURES: adicionais, horário, taxa entrega
-- Execute este arquivo no SQL Editor do Supabase
-- ============================================================

-- 1. Grupos de adicionais/complementos por item do cardápio
create table if not exists item_groups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  menu_item_id uuid references menu_items(id) on delete cascade not null,
  name text not null,
  required boolean not null default false,
  min_choices int not null default 0,
  max_choices int not null default 1,
  "order" int not null default 0,
  created_at timestamptz default now()
);

-- 2. Opções dentro de cada grupo
create table if not exists item_options (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  group_id uuid references item_groups(id) on delete cascade not null,
  name text not null,
  price_delta numeric not null default 0,
  "order" int not null default 0,
  created_at timestamptz default now()
);

-- RLS
alter table item_groups enable row level security;
alter table item_options enable row level security;

create policy "Users manage own item_groups" on item_groups
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Public read item_groups" on item_groups
  for select using (true);

create policy "Users manage own item_options" on item_options
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Public read item_options" on item_options
  for select using (true);

-- 3. Novas colunas em restaurant_settings
alter table restaurant_settings
  add column if not exists opening_hours jsonb not null default '{}'::jsonb,
  add column if not exists delivery_time text not null default '30-45',
  add column if not exists delivery_fee numeric not null default 0,
  add column if not exists delivery_neighborhoods jsonb not null default '[]'::jsonb;

-- opening_hours formato:
-- { "0": {"open": false, "from": "00:00", "to": "00:00"},  <- domingo
--   "1": {"open": true,  "from": "09:00", "to": "22:00"},  <- segunda
--   ...
--   "6": {"open": true,  "from": "09:00", "to": "23:00"} } <- sábado

-- delivery_neighborhoods formato:
-- [{"name": "Centro", "fee": 5.00}, {"name": "Jardim América", "fee": 8.00}]
