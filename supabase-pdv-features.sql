-- ============================================================
-- ZapMenu v2 — PDV, Fichas Técnicas, Fornecedores, Contas, DRE
-- Execute no Supabase SQL Editor
-- ============================================================

-- Fornecedores
CREATE TABLE IF NOT EXISTS suppliers (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name         text NOT NULL,
  email        text DEFAULT '',
  phone        text DEFAULT '',
  cnpj         text DEFAULT '',
  address      text DEFAULT '',
  contact_name text DEFAULT '',
  notes        text DEFAULT '',
  active       boolean DEFAULT true,
  created_at   timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_suppliers_user ON suppliers(user_id);
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "suppliers_owner" ON suppliers;
CREATE POLICY "suppliers_owner" ON suppliers FOR ALL USING (auth.uid() = user_id);

-- Fichas Técnicas
CREATE TABLE IF NOT EXISTS recipe_ingredients (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  menu_item_id uuid REFERENCES menu_items(id) ON DELETE CASCADE,
  name         text NOT NULL,
  quantity     numeric NOT NULL DEFAULT 0,
  unit         text DEFAULT 'g',
  unit_cost    numeric NOT NULL DEFAULT 0,
  supplier_id  uuid REFERENCES suppliers(id) ON DELETE SET NULL,
  created_at   timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_recipe_user ON recipe_ingredients(user_id);
CREATE INDEX IF NOT EXISTS idx_recipe_item ON recipe_ingredients(menu_item_id);
ALTER TABLE recipe_ingredients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "recipe_owner" ON recipe_ingredients;
CREATE POLICY "recipe_owner" ON recipe_ingredients FOR ALL USING (auth.uid() = user_id);

-- Pedidos de Compra
CREATE TABLE IF NOT EXISTS purchase_orders (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  supplier_id   uuid REFERENCES suppliers(id) ON DELETE SET NULL,
  status        text DEFAULT 'draft' CHECK (status IN ('draft','sent','received','cancelled')),
  expected_date date,
  received_date date,
  total         numeric DEFAULT 0,
  notes         text DEFAULT '',
  created_at    timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_po_user ON purchase_orders(user_id);
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "po_owner" ON purchase_orders;
CREATE POLICY "po_owner" ON purchase_orders FOR ALL USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS purchase_order_items (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id   uuid REFERENCES purchase_orders(id) ON DELETE CASCADE,
  user_id    uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name       text NOT NULL,
  quantity   numeric NOT NULL DEFAULT 0,
  unit       text DEFAULT 'un',
  unit_cost  numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_poi_order ON purchase_order_items(order_id);
ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "poi_owner" ON purchase_order_items;
CREATE POLICY "poi_owner" ON purchase_order_items FOR ALL USING (auth.uid() = user_id);

-- Contas a Pagar / Receber
CREATE TABLE IF NOT EXISTS financial_entries (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  type        text NOT NULL CHECK (type IN ('payable','receivable')),
  description text NOT NULL,
  amount      numeric NOT NULL DEFAULT 0,
  due_date    date NOT NULL,
  paid_date   date,
  status      text DEFAULT 'pending' CHECK (status IN ('pending','paid','overdue','cancelled')),
  category    text DEFAULT '',
  supplier_id uuid REFERENCES suppliers(id) ON DELETE SET NULL,
  notes       text DEFAULT '',
  recurrence  text DEFAULT 'none' CHECK (recurrence IN ('none','monthly','weekly','yearly')),
  created_at  timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fe_user   ON financial_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_fe_due    ON financial_entries(user_id, due_date);
CREATE INDEX IF NOT EXISTS idx_fe_status ON financial_entries(user_id, status);
ALTER TABLE financial_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "fe_owner" ON financial_entries;
CREATE POLICY "fe_owner" ON financial_entries FOR ALL USING (auth.uid() = user_id);

-- Cardápio por Filial
CREATE TABLE IF NOT EXISTS menu_item_branches (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  menu_item_id uuid REFERENCES menu_items(id) ON DELETE CASCADE,
  branch_id    uuid REFERENCES branches(id) ON DELETE CASCADE,
  available    boolean DEFAULT true,
  created_at   timestamptz DEFAULT now(),
  UNIQUE(menu_item_id, branch_id)
);
CREATE INDEX IF NOT EXISTS idx_mib_item   ON menu_item_branches(menu_item_id);
CREATE INDEX IF NOT EXISTS idx_mib_branch ON menu_item_branches(branch_id);
ALTER TABLE menu_item_branches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "mib_owner" ON menu_item_branches;
CREATE POLICY "mib_owner" ON menu_item_branches FOR ALL USING (auth.uid() = user_id);
