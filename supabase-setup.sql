-- =========================================
-- ZapMenu — Supabase Tables Setup
-- Execute no SQL Editor do Supabase
-- =========================================

-- 1. Configurações do restaurante
create table if not exists restaurant_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  slug text not null default '',
  accent_color text not null default '#059669',
  description text not null default '',
  address text not null default '',
  phone text not null default '',
  logo_url text not null default '',
  xgate_email text not null default '',
  xgate_password text not null default '',
  payment_methods text[] not null default array['pix','cash'],
  whatsapp_api_token text not null default '',
  whatsapp_phone_number_id text not null default '',
  whatsapp_enabled boolean not null default false,
  created_at timestamptz not null default now()
);
alter table restaurant_settings enable row level security;
create policy "Owners manage their settings" on restaurant_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Public can read settings" on restaurant_settings
  for select using (true);

-- 2. Categorias
create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  emoji text not null default '📁',
  "order" integer not null default 0,
  created_at timestamptz not null default now()
);
alter table categories enable row level security;
create policy "Owners manage their categories" on categories
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Public can read categories" on categories
  for select using (true);

-- 3. Itens do cardápio
create table if not exists menu_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid not null references categories(id) on delete cascade,
  name text not null,
  description text not null default '',
  emoji text not null default '🍽️',
  price numeric(10,2) not null default 0,
  available boolean not null default true,
  "order" integer not null default 0,
  created_at timestamptz not null default now()
);
alter table menu_items enable row level security;
create policy "Owners manage their menu items" on menu_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Public can read menu items" on menu_items
  for select using (true);

-- 4. Pedidos
create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  items jsonb not null default '[]',
  total numeric(10,2) not null,
  status text not null default 'PENDING',
  customer_name text not null,
  customer_phone text not null,
  payment_method text not null,
  delivery_address jsonb,
  delivery_type text not null default 'pickup',
  pix_tx_id text not null default '',
  pix_qr_code text not null default '',
  pix_copy_paste text not null default '',
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
alter table orders enable row level security;
create policy "Owners manage their orders" on orders
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- Clientes anônimos podem criar pedidos
create policy "Public can place orders" on orders
  for insert with check (true);

-- 5. Scans (QR Code)
create table if not exists scans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  scanned_at timestamptz not null default now()
);
alter table scans enable row level security;
create policy "Owners manage their scans" on scans
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- Clientes anônimos podem registrar scans
create policy "Public can add scans" on scans
  for insert with check (true);
