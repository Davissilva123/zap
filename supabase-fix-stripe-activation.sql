-- =====================================================
-- FIX COMPLETO — Ativação Stripe + Paywall
-- Execute no Supabase > SQL Editor
-- =====================================================

-- 1. Garante que colunas necessárias existem
ALTER TABLE restaurant_plans
  ADD COLUMN IF NOT EXISTS plan_name        TEXT,
  ADD COLUMN IF NOT EXISTS payment_status   TEXT DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS last_payment_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS next_billing_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS stripe_customer_id     TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS overdue_since    TIMESTAMPTZ;

-- Preenche plan_name para linhas existentes que têm plan_id mas não têm plan_name
UPDATE restaurant_plans rp
SET plan_name = p.slug
FROM plans p
WHERE p.id = rp.plan_id
  AND rp.plan_name IS NULL;

-- 2. Função de ativação pós-pagamento Stripe (SECURITY DEFINER — bypass RLS)
CREATE OR REPLACE FUNCTION activate_stripe_plan(
  p_user_id          UUID,
  p_plan_slug        TEXT,
  p_stripe_sub_id    TEXT,
  p_stripe_customer  TEXT,
  p_next_billing_at  TIMESTAMPTZ
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan_id UUID;
BEGIN
  -- Busca plan_id pelo slug
  SELECT id INTO v_plan_id FROM plans WHERE slug = p_plan_slug;
  -- Fallback: qualquer plano ativo
  IF v_plan_id IS NULL THEN
    SELECT id INTO v_plan_id FROM plans WHERE active = true ORDER BY price_brl ASC LIMIT 1;
  END IF;

  INSERT INTO restaurant_plans (
    user_id, plan_id, plan_name, status, payment_status,
    stripe_subscription_id, stripe_customer_id,
    last_payment_at, next_billing_at, overdue_since
  ) VALUES (
    p_user_id,
    v_plan_id,
    p_plan_slug,
    'active',
    'active',
    p_stripe_sub_id,
    p_stripe_customer,
    NOW(),
    p_next_billing_at,
    NULL
  )
  ON CONFLICT (user_id) DO UPDATE
    SET plan_id                = COALESCE(EXCLUDED.plan_id, restaurant_plans.plan_id),
        plan_name              = EXCLUDED.plan_name,
        status                 = 'active',
        payment_status         = 'active',
        stripe_subscription_id = EXCLUDED.stripe_subscription_id,
        stripe_customer_id     = EXCLUDED.stripe_customer_id,
        last_payment_at        = NOW(),
        next_billing_at        = EXCLUDED.next_billing_at,
        overdue_since          = NULL,
        blocked_reason         = NULL;

  -- Desbloqueia o cardápio
  UPDATE restaurant_settings
    SET blocked = false, blocked_reason = NULL
    WHERE user_id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION activate_stripe_plan(UUID, TEXT, TEXT, TEXT, TIMESTAMPTZ) TO service_role;

-- 3. get_my_plan — suporta plan_id e plan_name, expira após next_billing_at
CREATE OR REPLACE FUNCTION get_my_plan()
RETURNS TABLE (
  plan_slug        TEXT,
  plan_name        TEXT,
  status           TEXT,
  payment_status   TEXT,
  trial_ends_at    TIMESTAMPTZ,
  next_billing_at  TIMESTAMPTZ,
  last_payment_at  TIMESTAMPTZ,
  is_blocked       BOOLEAN,
  days_remaining   INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  RETURN QUERY
  SELECT
    -- plan_slug: usa plan_name se existir, senão pega do join com plans
    COALESCE(rp.plan_name, p.slug, 'none')                AS plan_slug,
    COALESCE(p.name, rp.plan_name, 'Sem plano')           AS plan_name,

    -- Expira automaticamente se next_billing_at passou
    CASE
      WHEN rp.status = 'active'
        AND rp.next_billing_at IS NOT NULL
        AND rp.next_billing_at < NOW()
      THEN 'expired'
      ELSE COALESCE(rp.status, 'none')
    END                                                   AS status,

    COALESCE(rp.payment_status, 'none')                   AS payment_status,
    rp.trial_ends_at,
    rp.next_billing_at,
    rp.last_payment_at,

    -- Lê coluna blocked (nome correto) com fallback para is_blocked (legado)
    COALESCE(rs.blocked, FALSE)                           AS is_blocked,

    CASE
      WHEN rp.status = 'trial' AND rp.trial_ends_at IS NOT NULL
        THEN GREATEST(0, EXTRACT(DAY FROM (rp.trial_ends_at - NOW()))::INTEGER)
      WHEN rp.status = 'active'
        AND rp.next_billing_at IS NOT NULL
        AND rp.next_billing_at >= NOW()
        THEN GREATEST(0, EXTRACT(DAY FROM (rp.next_billing_at - NOW()))::INTEGER)
      ELSE 0
    END                                                   AS days_remaining

  FROM restaurant_plans rp
  LEFT JOIN plans p ON (
    p.id   = rp.plan_id
    OR p.slug = rp.plan_name
  )
  LEFT JOIN restaurant_settings rs ON rs.user_id = rp.user_id
  WHERE rp.user_id = v_user_id
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION get_my_plan() TO authenticated;
