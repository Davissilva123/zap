-- v5: pedido mínimo para delivery
ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS minimum_order NUMERIC DEFAULT 0;

-- Permite operadores (kitchen role) marcar itens como indisponíveis
-- Execute este bloco para habilitar o botão "86" na cozinha:
-- (requer que o operador esteja cadastrado na tabela 'operators' com owner_id correto)
CREATE POLICY IF NOT EXISTS "operators can update menu items for their restaurant"
  ON menu_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM operators
      WHERE operators.owner_id = menu_items.user_id
        AND operators.user_id = auth.uid()
        AND operators.active = true
    )
  );
