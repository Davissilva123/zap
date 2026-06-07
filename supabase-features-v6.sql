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
