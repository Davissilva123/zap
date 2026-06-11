-- ============================================================
-- ZapMenu — CORRECAO EMERGENCIAL (rode este, nao o anterior)
-- Restaura get_mrr_stats e get_platform_stats corretamente
-- Execute no Supabase SQL Editor
-- ============================================================

CREATE OR REPLACE FUNCTION get_mrr_stats()
RETURNS TABLE(
  mrr_current        NUMERIC,
  arr                NUMERIC,
  active_paid        BIGINT,
  in_trial           BIGINT,
  trials_expiring_7d BIGINT,
  churned_month      BIGINT,
  total_restaurants  BIGINT
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_excluded_ids UUID[];
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM super_admins sa JOIN auth.users u ON u.email = sa.email WHERE u.id = auth.uid()
  ) THEN RAISE EXCEPTION 'Acesso negado'; END IF;

  -- Exclui apenas super admins (tabela garantida de existir)
  SELECT ARRAY_AGG(u.id) INTO v_excluded_ids
  FROM super_admins sa
  JOIN auth.users u ON u.email = sa.email;

  IF v_excluded_ids IS NULL THEN v_excluded_ids := ARRAY[]::UUID[]; END IF;

  RETURN QUERY
  SELECT
    COALESCE(SUM(CASE WHEN rp.status = 'active' THEN p.price_brl ELSE 0 END), 0)::NUMERIC,
    COALESCE(SUM(CASE WHEN rp.status = 'active' THEN p.price_brl * 12 ELSE 0 END), 0)::NUMERIC,
    COUNT(CASE WHEN rp.status = 'active' THEN 1 END),
    COUNT(CASE WHEN rp.status = 'trial' THEN 1 END),
    COUNT(CASE WHEN rp.status = 'trial'
                    AND rp.trial_ends_at IS NOT NULL
                    AND rp.trial_ends_at > NOW()
                    AND rp.trial_ends_at <= NOW() + INTERVAL '7 days' THEN 1 END),
    COUNT(CASE WHEN rp.status IN ('cancelled','expired','blocked')
                    AND rp.blocked_at IS NOT NULL
                    AND rp.blocked_at >= date_trunc('month', NOW()) THEN 1 END),
    (
      SELECT COUNT(*)::BIGINT
      FROM restaurant_settings rs
      WHERE NOT (rs.user_id = ANY(v_excluded_ids))
    )
  FROM restaurant_plans rp
  JOIN plans p ON p.id = rp.plan_id
  WHERE NOT (rp.user_id = ANY(v_excluded_ids));
END;
$$;
GRANT EXECUTE ON FUNCTION get_mrr_stats() TO authenticated;

-- -------------------------------------------------------

CREATE OR REPLACE FUNCTION get_platform_stats()
RETURNS TABLE(
  total_restaurants BIGINT,
  total_orders      BIGINT,
  total_revenue     NUMERIC,
  orders_today      BIGINT,
  revenue_today     NUMERIC
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_excluded_ids UUID[];
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM super_admins sa
    INNER JOIN auth.users u ON u.email = sa.email
    WHERE u.id = auth.uid()
  ) THEN RAISE EXCEPTION 'Acesso negado'; END IF;

  SELECT ARRAY_AGG(u.id) INTO v_excluded_ids
  FROM super_admins sa
  JOIN auth.users u ON u.email = sa.email;

  IF v_excluded_ids IS NULL THEN v_excluded_ids := ARRAY[]::UUID[]; END IF;

  RETURN QUERY
  SELECT
    (SELECT COUNT(*)::BIGINT FROM restaurant_settings rs WHERE NOT (rs.user_id = ANY(v_excluded_ids))),
    (SELECT COUNT(*)::BIGINT FROM orders o WHERE NOT (o.user_id = ANY(v_excluded_ids))),
    (SELECT COALESCE(SUM(total), 0)::NUMERIC FROM orders o WHERE o.status = 'COMPLETED' AND NOT (o.user_id = ANY(v_excluded_ids))),
    (SELECT COUNT(*)::BIGINT FROM orders o WHERE o.created_at >= CURRENT_DATE AND NOT (o.user_id = ANY(v_excluded_ids))),
    (SELECT COALESCE(SUM(total), 0)::NUMERIC FROM orders o WHERE o.status = 'COMPLETED' AND o.created_at >= CURRENT_DATE AND NOT (o.user_id = ANY(v_excluded_ids)));
END;
$$;
GRANT EXECUTE ON FUNCTION get_platform_stats() TO authenticated;
