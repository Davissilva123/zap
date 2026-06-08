-- ============================================================
-- ZapMenu — Planos v2: Básico, Pro, Premium (trial 7 dias)
-- Execute no Supabase > SQL Editor
-- ============================================================

-- Adicionar coluna trial_days se ainda não existir
ALTER TABLE plans ADD COLUMN IF NOT EXISTS trial_days INTEGER DEFAULT 7;

-- Remover planos antigos e inserir novos
DELETE FROM plans WHERE slug IN ('free', 'basic', 'pro', 'premium');

INSERT INTO plans (name, slug, price_brl, max_items, max_operators, trial_days, features) VALUES
  ('Básico', 'basic', 39, 50, 2, 7,
   '["cardapio","qrcode","pedidos","portal_cliente","whatsapp_manual"]'::jsonb),
  ('Pro', 'pro', 89, -1, 5, 7,
   '["cardapio","qrcode","pedidos","portal_cliente","pix","whatsapp","reports","coupons"]'::jsonb),
  ('Premium', 'premium', 149, -1, -1, 7,
   '["cardapio","qrcode","pedidos","portal_cliente","pix","whatsapp","reports","coupons","drivers","kds","operators","comandas","reviews"]'::jsonb);

-- Atualizar referências de planos antigos para 'basic'
UPDATE restaurant_plans rp
SET plan_id = (SELECT id FROM plans WHERE slug = 'basic')
WHERE NOT EXISTS (
  SELECT 1 FROM plans p WHERE p.id = rp.plan_id AND p.slug IN ('basic','pro','premium')
);

-- ============================================================
-- FIM
-- ============================================================
