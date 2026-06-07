-- v6: promo_price, featured, stock em menu_items; notes em orders; mercado_pago_token em restaurant_settings

-- Menu items: preço promocional, destaque, e controle de estoque
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS promo_price NUMERIC DEFAULT NULL;
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS featured BOOLEAN DEFAULT FALSE;
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS stock INTEGER DEFAULT NULL;

-- Orders: observações do cliente
ALTER TABLE orders ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT NULL;

-- Restaurant settings: token Mercado Pago e cashback
ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS mercado_pago_token TEXT DEFAULT '';
ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS cashback_percent NUMERIC DEFAULT 0;

-- Pedido mínimo para delivery (caso não tenha sido aplicado ainda pelo v5)
ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS minimum_order NUMERIC DEFAULT 0;

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
