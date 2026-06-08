-- ============================================================
-- ZapMenu — Funções extras do painel Super-Admin
-- Execute APÓS supabase-features-v7.sql
-- ============================================================

-- -------------------------------------------------------
-- 1. Estatísticas globais da plataforma
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION get_platform_stats()
RETURNS TABLE(
  total_restaurants BIGINT,
  total_orders      BIGINT,
  total_revenue     NUMERIC,
  orders_today      BIGINT,
  revenue_today     NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM super_admins sa
    INNER JOIN auth.users u ON u.email = sa.email
    WHERE u.id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  RETURN QUERY
  SELECT
    (SELECT COUNT(*)::BIGINT FROM restaurant_settings),
    (SELECT COUNT(*)::BIGINT FROM orders),
    (SELECT COALESCE(SUM(total), 0)::NUMERIC FROM orders WHERE status = 'COMPLETED'),
    (SELECT COUNT(*)::BIGINT FROM orders WHERE created_at >= CURRENT_DATE),
    (SELECT COALESCE(SUM(total), 0)::NUMERIC FROM orders WHERE status = 'COMPLETED' AND created_at >= CURRENT_DATE);
END;
$$;

GRANT EXECUTE ON FUNCTION get_platform_stats() TO authenticated;

-- -------------------------------------------------------
-- 2. Estatísticas por restaurante
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION get_restaurant_stats()
RETURNS TABLE(
  user_id       UUID,
  order_count   BIGINT,
  total_revenue NUMERIC,
  last_order_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM super_admins sa
    INNER JOIN auth.users u ON u.email = sa.email
    WHERE u.id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  RETURN QUERY
  SELECT
    o.user_id,
    COUNT(*)::BIGINT,
    COALESCE(SUM(CASE WHEN o.status = 'COMPLETED' THEN o.total ELSE 0 END), 0)::NUMERIC,
    MAX(o.created_at)
  FROM orders o
  GROUP BY o.user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION get_restaurant_stats() TO authenticated;

-- -------------------------------------------------------
-- 3. Planos de todos os restaurantes (super-admin)
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION get_all_restaurant_plans()
RETURNS TABLE(
  user_id    UUID,
  plan_slug  TEXT,
  plan_name  TEXT,
  status     TEXT,
  expires_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM super_admins sa
    INNER JOIN auth.users u ON u.email = sa.email
    WHERE u.id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  RETURN QUERY
  SELECT rp.user_id, p.slug, p.name, rp.status, rp.expires_at
  FROM restaurant_plans rp
  INNER JOIN plans p ON p.id = rp.plan_id;
END;
$$;

GRANT EXECUTE ON FUNCTION get_all_restaurant_plans() TO authenticated;

-- -------------------------------------------------------
-- FIM DO SCRIPT
-- -------------------------------------------------------
