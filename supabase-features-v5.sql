-- v5: pedido mínimo para delivery
ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS minimum_order NUMERIC DEFAULT 0;

-- Permite operadores (kitchen role) marcar itens como indisponíveis
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
