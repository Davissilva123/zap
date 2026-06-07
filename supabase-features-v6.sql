-- v6: promo_price, featured, stock, cost em menu_items; notes, driver_name em orders; cashback, mercado_pago, etc em restaurant_settings; available_from/to em categories

-- Menu items: preço promocional, destaque, estoque e custo de produção
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS promo_price NUMERIC DEFAULT NULL;
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS featured BOOLEAN DEFAULT FALSE;
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS stock INTEGER DEFAULT NULL;
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS cost NUMERIC DEFAULT NULL;

-- Orders: observações do cliente e nome do entregador
ALTER TABLE orders ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS driver_name TEXT DEFAULT NULL;

-- Restaurant settings: token Mercado Pago e cashback
ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS mercado_pago_token TEXT DEFAULT '';
ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS cashback_percent NUMERIC DEFAULT 0;

-- Pedido mínimo para delivery (caso não tenha sido aplicado ainda pelo v5)
ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS minimum_order NUMERIC DEFAULT 0;

-- Categorias: disponibilidade por horário
ALTER TABLE categories ADD COLUMN IF NOT EXISTS available_from TEXT DEFAULT NULL;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS available_to TEXT DEFAULT NULL;

-- Policy: público pode ler avaliações (pedidos com rating)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'orders'
      AND policyname = 'Public can read rated orders'
  ) THEN
    EXECUTE '
      CREATE POLICY "Public can read rated orders"
        ON orders FOR SELECT
        USING (rating IS NOT NULL AND rating > 0)
    ';
  END IF;
END $$;

-- Tabela de entregadores
CREATE TABLE IF NOT EXISTS drivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT DEFAULT '',
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'drivers' AND policyname = 'owners can manage their drivers'
  ) THEN
    EXECUTE '
      CREATE POLICY "owners can manage their drivers"
        ON drivers FOR ALL
        USING (auth.uid() = user_id)
        WITH CHECK (auth.uid() = user_id)
    ';
  END IF;
END $$;

-- Portal do entregador: access_token e driver_id
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS access_token UUID DEFAULT gen_random_uuid();
ALTER TABLE orders ADD COLUMN IF NOT EXISTS driver_id UUID REFERENCES drivers(id) DEFAULT NULL;

-- Funções SECURITY DEFINER para o portal do entregador (sem auth)
CREATE OR REPLACE FUNCTION get_driver_by_token(p_token UUID)
RETURNS TABLE(id UUID, name TEXT, phone TEXT)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT d.id, d.name, d.phone FROM drivers d WHERE d.access_token = p_token LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION get_driver_orders(p_token UUID)
RETURNS SETOF orders
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT o.* FROM orders o
  JOIN drivers d ON d.id = o.driver_id
  WHERE d.access_token = p_token AND o.status = 'DELIVERING'
  ORDER BY o.created_at DESC;
$$;

CREATE OR REPLACE FUNCTION complete_driver_order(p_token UUID, p_order_id UUID)
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE orders SET status = 'COMPLETED'
  WHERE id = p_order_id
    AND driver_id = (SELECT id FROM drivers WHERE access_token = p_token);
$$;

-- Policy: operadores podem atualizar itens do menu (para marcar esgotado via KDS)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'menu_items'
      AND policyname = 'operators can update menu items for their restaurant'
  ) THEN
    EXECUTE '
      CREATE POLICY "operators can update menu items for their restaurant"
        ON menu_items FOR UPDATE
        USING (
          EXISTS (
            SELECT 1 FROM operators
            WHERE operators.owner_id = menu_items.user_id
              AND operators.user_id = auth.uid()
              AND operators.active = true
          )
        )
    ';
  END IF;
END $$;
