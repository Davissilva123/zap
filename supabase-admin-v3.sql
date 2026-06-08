-- ============================================================
-- ZapMenu Admin v3 — MRR, Trials, Block, Audit, Emails
-- Execute no Supabase > SQL Editor
-- ============================================================

-- -------------------------------------------------------
-- 1. Novos campos em restaurant_settings
-- -------------------------------------------------------
ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS blocked BOOLEAN DEFAULT FALSE;
ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS blocked_reason TEXT;
ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS blocked_at TIMESTAMPTZ;

-- -------------------------------------------------------
-- 2. Novos campos em restaurant_plans
-- -------------------------------------------------------
ALTER TABLE restaurant_plans ADD COLUMN IF NOT EXISTS trial_starts_at TIMESTAMPTZ;
ALTER TABLE restaurant_plans ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;
ALTER TABLE restaurant_plans ADD COLUMN IF NOT EXISTS blocked_reason TEXT;
ALTER TABLE restaurant_plans ADD COLUMN IF NOT EXISTS blocked_at TIMESTAMPTZ;

-- -------------------------------------------------------
-- 3. Log de mudanças de plano (auditoria)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS plan_change_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL,
  old_plan_slug TEXT,
  new_plan_slug TEXT NOT NULL,
  old_status   TEXT,
  new_status   TEXT NOT NULL,
  notes        TEXT,
  changed_at   TIMESTAMPTZ DEFAULT NOW(),
  changed_by   UUID
);

ALTER TABLE plan_change_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "superadmin_plan_change_log" ON plan_change_log;
CREATE POLICY "superadmin_plan_change_log" ON plan_change_log FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM super_admins sa
    JOIN auth.users u ON u.email = sa.email
    WHERE u.id = auth.uid()
  )
);

-- -------------------------------------------------------
-- 4. Emails dos donos dos restaurantes
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION get_owner_emails()
RETURNS TABLE(user_id UUID, email TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM super_admins sa JOIN auth.users u ON u.email = sa.email WHERE u.id = auth.uid()
  ) THEN RAISE EXCEPTION 'Acesso negado'; END IF;

  RETURN QUERY
  SELECT u.id, u.email::TEXT
  FROM auth.users u
  WHERE u.id IN (SELECT rs.user_id FROM restaurant_settings rs)
  ORDER BY u.created_at DESC;
END;
$$;
GRANT EXECUTE ON FUNCTION get_owner_emails() TO authenticated;

-- -------------------------------------------------------
-- 5. MRR, ARR e métricas de negócio
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION get_mrr_stats()
RETURNS TABLE(
  mrr_current       NUMERIC,
  arr               NUMERIC,
  active_paid       BIGINT,
  in_trial          BIGINT,
  trials_expiring_7d BIGINT,
  churned_month     BIGINT,
  total_restaurants BIGINT
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM super_admins sa JOIN auth.users u ON u.email = sa.email WHERE u.id = auth.uid()
  ) THEN RAISE EXCEPTION 'Acesso negado'; END IF;

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
    COUNT(CASE WHEN rp.status IN ('cancelled','expired')
                    AND rp.blocked_at >= date_trunc('month', NOW()) THEN 1 END),
    (SELECT COUNT(*)::BIGINT FROM restaurant_settings)
  FROM restaurant_plans rp
  JOIN plans p ON p.id = rp.plan_id;
END;
$$;
GRANT EXECUTE ON FUNCTION get_mrr_stats() TO authenticated;

-- -------------------------------------------------------
-- 6. Planos de todos os restaurantes (versão completa)
-- -------------------------------------------------------
DROP FUNCTION IF EXISTS get_all_restaurant_plans();
CREATE OR REPLACE FUNCTION get_all_restaurant_plans()
RETURNS TABLE(
  user_id        UUID,
  plan_slug      TEXT,
  plan_name      TEXT,
  plan_price     NUMERIC,
  status         TEXT,
  trial_starts_at TIMESTAMPTZ,
  trial_ends_at  TIMESTAMPTZ,
  blocked_reason TEXT,
  expires_at     TIMESTAMPTZ
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM super_admins sa JOIN auth.users u ON u.email = sa.email WHERE u.id = auth.uid()
  ) THEN RAISE EXCEPTION 'Acesso negado'; END IF;

  RETURN QUERY
  SELECT rp.user_id, p.slug, p.name, p.price_brl, rp.status,
         rp.trial_starts_at, rp.trial_ends_at, rp.blocked_reason, rp.expires_at
  FROM restaurant_plans rp
  JOIN plans p ON p.id = rp.plan_id;
END;
$$;
GRANT EXECUTE ON FUNCTION get_all_restaurant_plans() TO authenticated;

-- -------------------------------------------------------
-- 7. set_restaurant_plan com log e trial automático
-- -------------------------------------------------------
DROP FUNCTION IF EXISTS set_restaurant_plan(UUID, TEXT, TIMESTAMPTZ);
CREATE OR REPLACE FUNCTION set_restaurant_plan(
  p_target_user_id UUID,
  p_plan_slug      TEXT,
  p_status         TEXT DEFAULT 'trial',
  p_notes          TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_plan_id       UUID;
  v_old_plan_slug TEXT;
  v_old_status    TEXT;
  v_trial_ends_at TIMESTAMPTZ;
  v_trial_days    INTEGER;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM super_admins sa JOIN auth.users u ON u.email = sa.email WHERE u.id = auth.uid()
  ) THEN RAISE EXCEPTION 'Acesso negado'; END IF;

  SELECT id, trial_days INTO v_plan_id, v_trial_days FROM plans WHERE slug = p_plan_slug AND active = TRUE;
  IF v_plan_id IS NULL THEN RAISE EXCEPTION 'Plano não encontrado: %', p_plan_slug; END IF;

  -- Current plan for audit log
  SELECT p.slug, rp.status INTO v_old_plan_slug, v_old_status
  FROM restaurant_plans rp JOIN plans p ON p.id = rp.plan_id
  WHERE rp.user_id = p_target_user_id;

  -- Trial end date
  IF p_status = 'trial' THEN
    v_trial_ends_at := NOW() + (v_trial_days || ' days')::INTERVAL;
  END IF;

  INSERT INTO restaurant_plans (user_id, plan_id, status, trial_starts_at, trial_ends_at)
  VALUES (p_target_user_id, v_plan_id, p_status,
          CASE WHEN p_status = 'trial' THEN NOW() END,
          v_trial_ends_at)
  ON CONFLICT (user_id) DO UPDATE
    SET plan_id        = EXCLUDED.plan_id,
        status         = EXCLUDED.status,
        trial_starts_at = CASE WHEN EXCLUDED.status = 'trial' THEN NOW() ELSE restaurant_plans.trial_starts_at END,
        trial_ends_at  = EXCLUDED.trial_ends_at,
        blocked_reason = NULL,
        blocked_at     = NULL;

  -- Audit log
  INSERT INTO plan_change_log (user_id, old_plan_slug, new_plan_slug, old_status, new_status, notes, changed_by)
  VALUES (p_target_user_id, v_old_plan_slug, p_plan_slug, v_old_status, p_status, p_notes, auth.uid());
END;
$$;
GRANT EXECUTE ON FUNCTION set_restaurant_plan(UUID, TEXT, TEXT, TEXT) TO authenticated;

-- -------------------------------------------------------
-- 8. Bloquear restaurante
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION block_restaurant(p_user_id UUID, p_reason TEXT DEFAULT '')
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_old_status TEXT; v_old_slug TEXT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM super_admins sa JOIN auth.users u ON u.email = sa.email WHERE u.id = auth.uid()
  ) THEN RAISE EXCEPTION 'Acesso negado'; END IF;

  SELECT rp.status, p.slug INTO v_old_status, v_old_slug
  FROM restaurant_plans rp JOIN plans p ON p.id = rp.plan_id WHERE rp.user_id = p_user_id;

  UPDATE restaurant_plans
  SET status = 'blocked', blocked_reason = p_reason, blocked_at = NOW()
  WHERE user_id = p_user_id;

  UPDATE restaurant_settings
  SET blocked = TRUE, blocked_reason = p_reason, blocked_at = NOW()
  WHERE user_id = p_user_id;

  INSERT INTO plan_change_log (user_id, old_plan_slug, new_plan_slug, old_status, new_status, notes, changed_by)
  VALUES (p_user_id, v_old_slug, COALESCE(v_old_slug,'basic'), v_old_status, 'blocked', 'Bloqueado: ' || p_reason, auth.uid());
END;
$$;
GRANT EXECUTE ON FUNCTION block_restaurant(UUID, TEXT) TO authenticated;

-- -------------------------------------------------------
-- 9. Desbloquear restaurante
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION unblock_restaurant(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_old_slug TEXT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM super_admins sa JOIN auth.users u ON u.email = sa.email WHERE u.id = auth.uid()
  ) THEN RAISE EXCEPTION 'Acesso negado'; END IF;

  SELECT p.slug INTO v_old_slug
  FROM restaurant_plans rp JOIN plans p ON p.id = rp.plan_id WHERE rp.user_id = p_user_id;

  UPDATE restaurant_plans
  SET status = 'active', blocked_reason = NULL, blocked_at = NULL
  WHERE user_id = p_user_id AND status = 'blocked';

  UPDATE restaurant_settings
  SET blocked = FALSE, blocked_reason = NULL, blocked_at = NULL
  WHERE user_id = p_user_id;

  INSERT INTO plan_change_log (user_id, old_plan_slug, new_plan_slug, old_status, new_status, notes, changed_by)
  VALUES (p_user_id, v_old_slug, COALESCE(v_old_slug,'basic'), 'blocked', 'active', 'Desbloqueado pelo admin', auth.uid());
END;
$$;
GRANT EXECUTE ON FUNCTION unblock_restaurant(UUID) TO authenticated;

-- -------------------------------------------------------
-- 10. Histórico de mudanças de plano
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION get_plan_change_log(p_user_id UUID DEFAULT NULL)
RETURNS TABLE(
  id UUID, user_id UUID, old_plan_slug TEXT, new_plan_slug TEXT,
  old_status TEXT, new_status TEXT, notes TEXT,
  changed_at TIMESTAMPTZ, changed_by_email TEXT
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM super_admins sa JOIN auth.users u ON u.email = sa.email WHERE u.id = auth.uid()
  ) THEN RAISE EXCEPTION 'Acesso negado'; END IF;

  RETURN QUERY
  SELECT pcl.id, pcl.user_id, pcl.old_plan_slug, pcl.new_plan_slug,
         pcl.old_status, pcl.new_status, pcl.notes, pcl.changed_at,
         cb.email::TEXT
  FROM plan_change_log pcl
  LEFT JOIN auth.users cb ON cb.id = pcl.changed_by
  WHERE (p_user_id IS NULL OR pcl.user_id = p_user_id)
  ORDER BY pcl.changed_at DESC
  LIMIT 200;
END;
$$;
GRANT EXECUTE ON FUNCTION get_plan_change_log(UUID) TO authenticated;

-- -------------------------------------------------------
-- FIM DO SCRIPT v3
-- -------------------------------------------------------
