-- =====================================================
-- PAYWALL — controle de plano por usuário
-- Execute no Supabase > SQL Editor
-- =====================================================

-- Retorna o plano atual do usuário logado
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
    COALESCE(rp.plan_name, 'none')                        AS plan_slug,
    COALESCE(p.name, rp.plan_name, 'Sem plano')           AS plan_name,
    COALESCE(rp.status, 'none')                           AS status,
    COALESCE(rp.payment_status, 'none')                   AS payment_status,
    rp.trial_ends_at,
    rp.next_billing_at,
    rp.last_payment_at,
    COALESCE(rs.is_blocked, FALSE)                        AS is_blocked,
    CASE
      WHEN rp.status = 'trial' AND rp.trial_ends_at IS NOT NULL
        THEN GREATEST(0, EXTRACT(DAY FROM (rp.trial_ends_at - NOW()))::INTEGER)
      WHEN rp.status = 'active' AND rp.next_billing_at IS NOT NULL
        THEN GREATEST(0, EXTRACT(DAY FROM (rp.next_billing_at - NOW()))::INTEGER)
      ELSE 0
    END                                                   AS days_remaining
  FROM restaurant_plans rp
  LEFT JOIN plans p ON p.slug = rp.plan_name
  LEFT JOIN restaurant_settings rs ON rs.user_id = rp.user_id
  WHERE rp.user_id = v_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION get_my_plan() TO authenticated;

-- Inicia o trial gratuito (cria ou atualiza restaurant_plans)
CREATE OR REPLACE FUNCTION start_trial(p_plan_slug TEXT DEFAULT 'basic')
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_existing TEXT;
BEGIN
  -- Verifica se já tem plano ativo ou trial
  SELECT status INTO v_existing
  FROM restaurant_plans
  WHERE user_id = v_user_id;

  IF v_existing IN ('active', 'trial') THEN
    RAISE EXCEPTION 'Usuário já possui plano ativo ou trial em andamento';
  END IF;

  INSERT INTO restaurant_plans (
    user_id, plan_name, status, payment_status,
    trial_ends_at, next_billing_at
  ) VALUES (
    v_user_id,
    p_plan_slug,
    'trial',
    'trial',
    NOW() + INTERVAL '7 days',
    NOW() + INTERVAL '7 days'
  )
  ON CONFLICT (user_id) DO UPDATE
    SET plan_name       = EXCLUDED.plan_name,
        status          = 'trial',
        payment_status  = 'trial',
        trial_ends_at   = NOW() + INTERVAL '7 days',
        next_billing_at = NOW() + INTERVAL '7 days',
        overdue_since   = NULL;

  -- Desbloqueia o cardápio
  UPDATE restaurant_settings
  SET is_blocked = FALSE
  WHERE user_id = v_user_id;

  -- Notifica admin
  INSERT INTO admin_notifications (type, title, body, user_id)
  SELECT
    'new_signup',
    'Novo trial iniciado: ' || COALESCE(rs.restaurant_name, v_user_id::TEXT),
    'Plano ' || p_plan_slug || ' — trial de 7 dias ativado.',
    v_user_id
  FROM restaurant_settings rs
  WHERE rs.user_id = v_user_id
  ON CONFLICT DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION start_trial(TEXT) TO authenticated;
