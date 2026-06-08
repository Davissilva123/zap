-- =====================================================
-- STRIPE INTEGRATION - ZapMenu
-- Execute este arquivo no Supabase SQL Editor
-- =====================================================

-- Adiciona colunas Stripe na tabela restaurant_plans
ALTER TABLE restaurant_plans
  ADD COLUMN IF NOT EXISTS stripe_customer_id     TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_price_id        TEXT;

-- Índice para lookup por customer_id (webhook usa isso)
CREATE INDEX IF NOT EXISTS idx_restaurant_plans_stripe_customer
  ON restaurant_plans (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

-- Índice para lookup por subscription_id
CREATE INDEX IF NOT EXISTS idx_restaurant_plans_stripe_sub
  ON restaurant_plans (stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

-- Garante que apenas o próprio usuário ou service_role acessa os dados Stripe
-- (as colunas já estão na tabela protegida por RLS existente)

SELECT 'Stripe columns added successfully' AS status;
