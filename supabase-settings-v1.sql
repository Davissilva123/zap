-- =====================================================
-- PLATFORM SETTINGS — configurações globais da plataforma
-- Execute no Supabase > SQL Editor
-- =====================================================

CREATE TABLE IF NOT EXISTS platform_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Valor padrão: 7 dias de trial
INSERT INTO platform_settings (key, value)
VALUES ('trial_days', '7')
ON CONFLICT (key) DO NOTHING;

-- Leitura pública dos dias de trial
CREATE OR REPLACE FUNCTION get_trial_days()
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(value::INTEGER, 7)
  FROM platform_settings
  WHERE key = 'trial_days';
$$;

GRANT EXECUTE ON FUNCTION get_trial_days() TO authenticated, anon;

-- Atualização dos dias de trial (só super admin)
CREATE OR REPLACE FUNCTION set_trial_days(p_days INTEGER)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT;
BEGIN
  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();
  IF v_email NOT IN (SELECT email FROM super_admins) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  IF p_days < 1 OR p_days > 90 THEN
    RAISE EXCEPTION 'Dias de trial deve ser entre 1 e 90';
  END IF;
  INSERT INTO platform_settings (key, value, updated_at)
  VALUES ('trial_days', p_days::TEXT, NOW())
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
END;
$$;

GRANT EXECUTE ON FUNCTION set_trial_days(INTEGER) TO authenticated;

-- Recria start_trial usando os dias configurados
CREATE OR REPLACE FUNCTION start_trial(p_plan_slug TEXT DEFAULT 'basic')
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id  UUID := auth.uid();
  v_existing TEXT;
  v_days     INTEGER;
BEGIN
  SELECT status INTO v_existing FROM restaurant_plans WHERE user_id = v_user_id;
  IF v_existing IN ('active', 'trial') THEN
    RAISE EXCEPTION 'Usuário já possui plano ativo ou trial em andamento';
  END IF;

  SELECT COALESCE(value::INTEGER, 7) INTO v_days
  FROM platform_settings WHERE key = 'trial_days';

  INSERT INTO restaurant_plans (
    user_id, plan_name, status, payment_status, trial_ends_at, next_billing_at
  ) VALUES (
    v_user_id, p_plan_slug, 'trial', 'trial',
    NOW() + (v_days || ' days')::INTERVAL,
    NOW() + (v_days || ' days')::INTERVAL
  )
  ON CONFLICT (user_id) DO UPDATE
    SET plan_name       = EXCLUDED.plan_name,
        status          = 'trial',
        payment_status  = 'trial',
        trial_ends_at   = NOW() + (v_days || ' days')::INTERVAL,
        next_billing_at = NOW() + (v_days || ' days')::INTERVAL,
        overdue_since   = NULL;

  UPDATE restaurant_settings SET is_blocked = FALSE WHERE user_id = v_user_id;

  INSERT INTO admin_notifications (type, title, body, user_id)
  SELECT 'new_signup',
    'Novo trial: ' || COALESCE(rs.restaurant_name, v_user_id::TEXT),
    'Plano ' || p_plan_slug || ' — trial de ' || v_days || ' dias ativado.',
    v_user_id
  FROM restaurant_settings rs WHERE rs.user_id = v_user_id
  ON CONFLICT DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION start_trial(TEXT) TO authenticated;
