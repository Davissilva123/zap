-- =====================================================
-- ATIVAÇÃO DE PLANO VIA STRIPE (SECURITY DEFINER)
-- Execute no Supabase > SQL Editor
-- =====================================================

-- Função chamada pela Edge Function stripe-verify-session
-- Roda como superuser (bypassa RLS), não depende do client-side
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
BEGIN
  -- Ativa / atualiza o plano na tabela restaurant_plans
  INSERT INTO restaurant_plans (
    user_id,
    plan_name,
    status,
    payment_status,
    stripe_subscription_id,
    stripe_customer_id,
    last_payment_at,
    next_billing_at,
    overdue_since
  ) VALUES (
    p_user_id,
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
    SET plan_name              = EXCLUDED.plan_name,
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

-- Apenas service_role pode chamar (a Edge Function usa service_role key)
REVOKE ALL ON FUNCTION activate_stripe_plan(UUID, TEXT, TEXT, TEXT, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION activate_stripe_plan(UUID, TEXT, TEXT, TEXT, TIMESTAMPTZ) TO service_role;
