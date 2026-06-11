-- ============================================================
-- ZapMenu — Corrige contagem de trials e torna janela dinâmica
-- Execute no Supabase SQL Editor
-- ============================================================
-- Problemas corrigidos:
--  1. trials_expiring e in_trial contavam restaurant_plans sem
--     restaurant_settings (contas incompletas), inflando o número.
--  2. A janela de "próximos X dias" era hardcoded em 7.
--     Agora lê trial_days do plano 'basic' e devolve ao frontend.
-- ============================================================

CREATE OR REPLACE FUNCTION get_mrr_stats()
RETURNS TABLE(
  mrr_current        NUMERIC,
  arr                NUMERIC,
  active_paid        BIGINT,
  in_trial           BIGINT,
  trials_expiring_7d BIGINT,
  churned_month      BIGINT,
  total_restaurants  BIGINT,
  trial_days         INTEGER
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_excluded_ids UUID[];
  v_trial_days   INTEGER := 7;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM super_admins sa JOIN auth.users u ON u.email = sa.email WHERE u.id = auth.uid()
  ) THEN RAISE EXCEPTION 'Acesso negado'; END IF;

  -- IDs excluídos (apenas super admins — tabela garantida)
  SELECT ARRAY_AGG(u.id) INTO v_excluded_ids
  FROM super_admins sa
  JOIN auth.users u ON u.email = sa.email;

  IF v_excluded_ids IS NULL THEN v_excluded_ids := ARRAY[]::UUID[]; END IF;

  -- Lê trial_days configurado no plano basic (fallback: 7)
  SELECT COALESCE(p.trial_days, 7) INTO v_trial_days
  FROM plans p
  WHERE p.slug = 'basic'
  LIMIT 1;

  IF v_trial_days IS NULL THEN v_trial_days := 7; END IF;

  RETURN QUERY
  SELECT
    COALESCE(SUM(CASE WHEN rp.status = 'active' THEN p.price_brl ELSE 0 END), 0)::NUMERIC,
    COALESCE(SUM(CASE WHEN rp.status = 'active' THEN p.price_brl * 12 ELSE 0 END), 0)::NUMERIC,

    -- Clientes pagantes (só quem tem restaurant_settings)
    COUNT(CASE WHEN rp.status = 'active'
                    AND EXISTS (SELECT 1 FROM restaurant_settings rs WHERE rs.user_id = rp.user_id)
               THEN 1 END),

    -- Em trial: apenas usuários com restaurant_settings completo
    COUNT(CASE WHEN rp.status = 'trial'
                    AND EXISTS (SELECT 1 FROM restaurant_settings rs WHERE rs.user_id = rp.user_id)
               THEN 1 END),

    -- Trials expirando: janela dinâmica + só restaurantes completos
    COUNT(CASE WHEN rp.status = 'trial'
                    AND rp.trial_ends_at IS NOT NULL
                    AND rp.trial_ends_at > NOW()
                    AND rp.trial_ends_at <= NOW() + (v_trial_days || ' days')::INTERVAL
                    AND EXISTS (SELECT 1 FROM restaurant_settings rs WHERE rs.user_id = rp.user_id)
               THEN 1 END),

    COUNT(CASE WHEN rp.status IN ('cancelled','expired','blocked')
                    AND rp.blocked_at IS NOT NULL
                    AND rp.blocked_at >= date_trunc('month', NOW()) THEN 1 END),

    (SELECT COUNT(*)::BIGINT FROM restaurant_settings rs WHERE NOT (rs.user_id = ANY(v_excluded_ids))),

    v_trial_days
  FROM restaurant_plans rp
  JOIN plans p ON p.id = rp.plan_id
  WHERE NOT (rp.user_id = ANY(v_excluded_ids));
END;
$$;

GRANT EXECUTE ON FUNCTION get_mrr_stats() TO authenticated;
