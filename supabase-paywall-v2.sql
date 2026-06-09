-- =====================================================
-- PAYWALL v2 — corrige expiração mensal e coluna blocked
-- Execute no Supabase > SQL Editor
-- =====================================================

-- Retorna o plano atual do usuário logado
-- Corrigido:
--   1. status 'active' com next_billing_at no passado → retorna 'expired'
--   2. usa rs.blocked (não rs.is_blocked)
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

    -- Se o plano está 'active' mas next_billing_at já passou → expired
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

    -- Corrigido: coluna é 'blocked', não 'is_blocked'
    COALESCE(rs.blocked, FALSE)                           AS is_blocked,

    CASE
      WHEN rp.status = 'trial' AND rp.trial_ends_at IS NOT NULL
        THEN GREATEST(0, EXTRACT(DAY FROM (rp.trial_ends_at - NOW()))::INTEGER)
      WHEN rp.status = 'active' AND rp.next_billing_at IS NOT NULL AND rp.next_billing_at >= NOW()
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
