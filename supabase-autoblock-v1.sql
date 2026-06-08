-- ============================================================
-- supabase-autoblock-v1.sql
-- Bloqueio automático por inadimplência (dia 16)
-- Painel de cobranças
-- Execute APÓS supabase-billing-v1.sql
-- ============================================================

-- ---- Coluna para rastrear desde quando está inadimplente ----
ALTER TABLE restaurant_plans
  ADD COLUMN IF NOT EXISTS overdue_since TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS auto_block_enabled BOOLEAN DEFAULT true;

-- ---- Tabela de histórico de cobranças enviadas ----
CREATE TABLE IF NOT EXISTS billing_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sent_by TEXT NOT NULL,
  message TEXT,
  channel TEXT NOT NULL DEFAULT 'email', -- 'email', 'whatsapp', 'manual'
  sent_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE billing_reminders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "no_direct_billing_reminders" ON billing_reminders;
CREATE POLICY "no_direct_billing_reminders" ON billing_reminders FOR ALL USING (false);

-- ============================================================
-- FUNÇÃO: atualizar overdue_since quando trial/plano expira
-- ============================================================

-- Trigger: quando trial vence, define overdue_since
CREATE OR REPLACE FUNCTION update_overdue_since()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Se status mudou para trial-vencido e não tinha overdue_since
  IF NEW.status = 'trial' AND NEW.trial_ends_at < NOW() AND OLD.overdue_since IS NULL THEN
    NEW.overdue_since = NEW.trial_ends_at;
  END IF;
  -- Se status mudou para past_due e não tinha overdue_since
  IF NEW.status = 'past_due' AND OLD.overdue_since IS NULL THEN
    NEW.overdue_since = NOW();
  END IF;
  -- Se pagamento foi confirmado, limpa overdue_since
  IF NEW.status = 'active' THEN
    NEW.overdue_since = NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_plan_status_change ON restaurant_plans;
CREATE TRIGGER on_plan_status_change
  BEFORE UPDATE ON restaurant_plans
  FOR EACH ROW EXECUTE FUNCTION update_overdue_since();

-- ============================================================
-- FUNÇÃO: get_overdue_restaurants()
-- Lista todos os restaurantes inadimplentes com dias de atraso
-- ============================================================
CREATE OR REPLACE FUNCTION get_overdue_restaurants()
RETURNS TABLE(
  user_id UUID,
  restaurant_name TEXT,
  owner_email TEXT,
  owner_phone TEXT,
  plan_name TEXT,
  plan_price NUMERIC,
  status TEXT,
  overdue_since TIMESTAMPTZ,
  days_overdue INTEGER,
  days_until_auto_block INTEGER,
  reminder_count BIGINT,
  last_reminder_at TIMESTAMPTZ,
  blocked BOOLEAN
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF (SELECT email FROM auth.users WHERE id = auth.uid()) != 'sdavi6790@gmail.com' THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  RETURN QUERY
    SELECT
      rp.user_id,
      rs.name::TEXT,
      u.email::TEXT,
      rs.phone::TEXT,
      p.name::TEXT,
      p.price_brl::NUMERIC,
      rp.status::TEXT,
      -- overdue_since: usa coluna se preenchida, senão infere
      COALESCE(
        rp.overdue_since,
        CASE
          WHEN rp.status = 'trial' AND rp.trial_ends_at < NOW() THEN rp.trial_ends_at
          WHEN rp.status = 'past_due' THEN COALESCE(rp.next_billing_at, rp.created_at)
          WHEN rp.status = 'expired' THEN rp.expires_at
          ELSE NULL
        END
      ) as overdue_since,
      -- dias de atraso
      GREATEST(0, EXTRACT(DAY FROM NOW() - COALESCE(
        rp.overdue_since,
        CASE
          WHEN rp.status = 'trial' AND rp.trial_ends_at < NOW() THEN rp.trial_ends_at
          WHEN rp.status = 'past_due' THEN COALESCE(rp.next_billing_at, rp.created_at)
          WHEN rp.status = 'expired' THEN rp.expires_at
          ELSE NOW()
        END
      ))::INTEGER) as days_overdue,
      -- dias restantes até bloqueio automático (15 dias)
      GREATEST(0, 15 - GREATEST(0, EXTRACT(DAY FROM NOW() - COALESCE(
        rp.overdue_since,
        CASE
          WHEN rp.status = 'trial' AND rp.trial_ends_at < NOW() THEN rp.trial_ends_at
          WHEN rp.status = 'past_due' THEN COALESCE(rp.next_billing_at, rp.created_at)
          WHEN rp.status = 'expired' THEN rp.expires_at
          ELSE NOW()
        END
      ))::INTEGER)) as days_until_auto_block,
      -- contagem de cobranças enviadas
      COALESCE((SELECT COUNT(*) FROM billing_reminders br WHERE br.user_id = rp.user_id), 0)::BIGINT,
      -- última cobrança
      (SELECT MAX(br.sent_at) FROM billing_reminders br WHERE br.user_id = rp.user_id),
      -- bloqueado?
      COALESCE(rs.blocked, false)
    FROM restaurant_plans rp
    JOIN restaurant_settings rs ON rs.user_id = rp.user_id
    JOIN auth.users u ON u.id = rp.user_id
    JOIN plans p ON p.id = rp.plan_id
    WHERE rp.status IN ('trial', 'past_due', 'expired', 'blocked')
      AND (
        (rp.status = 'trial' AND rp.trial_ends_at < NOW())
        OR rp.status = 'past_due'
        OR rp.status = 'expired'
        OR rp.status = 'blocked'
      )
    ORDER BY days_overdue DESC;
END;
$$;

-- ============================================================
-- FUNÇÃO: auto_block_overdue_restaurants()
-- Bloqueia automaticamente após 15 dias (executa no dia 16)
-- ============================================================
CREATE OR REPLACE FUNCTION auto_block_overdue_restaurants()
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_count INTEGER := 0;
  v_rec RECORD;
  v_days_overdue INTEGER;
BEGIN
  FOR v_rec IN
    SELECT
      rp.user_id,
      rs.name as restaurant_name,
      COALESCE(
        rp.overdue_since,
        CASE
          WHEN rp.status = 'trial' AND rp.trial_ends_at < NOW() THEN rp.trial_ends_at
          WHEN rp.status = 'past_due' THEN COALESCE(rp.next_billing_at, rp.created_at)
          WHEN rp.status = 'expired' THEN rp.expires_at
          ELSE NULL
        END
      ) as overdue_since
    FROM restaurant_plans rp
    JOIN restaurant_settings rs ON rs.user_id = rp.user_id
    WHERE rp.status NOT IN ('blocked', 'active', 'cancelled')
      AND COALESCE(rp.auto_block_enabled, true) = true
      AND (
        (rp.status = 'trial' AND rp.trial_ends_at < NOW())
        OR rp.status = 'past_due'
        OR rp.status = 'expired'
      )
  LOOP
    -- Calcula dias de atraso
    IF v_rec.overdue_since IS NULL THEN
      CONTINUE;
    END IF;
    v_days_overdue := EXTRACT(DAY FROM NOW() - v_rec.overdue_since)::INTEGER;
    -- Bloqueia somente a partir do dia 16 (>= 15 dias de atraso)
    IF v_days_overdue >= 15 THEN
      -- Bloqueia restaurant_settings
      UPDATE restaurant_settings
      SET
        blocked = true,
        blocked_reason = format('Bloqueio automático — %s dias sem pagamento (dia %s)', v_days_overdue, v_days_overdue + 1)
      WHERE user_id = v_rec.user_id;
      -- Atualiza restaurant_plans
      UPDATE restaurant_plans
      SET
        status = 'blocked',
        blocked_reason = format('Inadimplência — %s dias sem pagamento', v_days_overdue),
        blocked_at = NOW()
      WHERE user_id = v_rec.user_id;
      -- Registra no histórico
      INSERT INTO plan_change_log (user_id, old_status, new_status, notes)
      VALUES (
        v_rec.user_id,
        'overdue',
        'blocked',
        format('Bloqueio automático — %s dias de inadimplência', v_days_overdue)
      );
      -- Notificação para o admin
      INSERT INTO admin_notifications (type, title, body, user_id)
      VALUES (
        'auto_blocked',
        'Restaurante bloqueado automaticamente',
        format('"%s" foi bloqueado após %s dias sem pagamento', v_rec.restaurant_name, v_days_overdue),
        v_rec.user_id
      );
      v_count := v_count + 1;
    END IF;
  END LOOP;
  RETURN v_count;
END;
$$;

-- ============================================================
-- FUNÇÃO: mark_payment_received(user_id, notes)
-- Confirma pagamento e reativa o restaurante
-- ============================================================
CREATE OR REPLACE FUNCTION mark_payment_received(p_user_id UUID, p_notes TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_admin_email TEXT := 'sdavi6790@gmail.com';
  v_old_status TEXT;
BEGIN
  IF (SELECT email FROM auth.users WHERE id = auth.uid()) != v_admin_email THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  SELECT status INTO v_old_status FROM restaurant_plans WHERE user_id = p_user_id;
  -- Reativa plano
  UPDATE restaurant_plans
  SET
    status = 'active',
    payment_status = 'active',
    last_payment_at = NOW(),
    next_billing_at = NOW() + INTERVAL '30 days',
    overdue_since = NULL,
    blocked_reason = NULL,
    blocked_at = NULL
  WHERE user_id = p_user_id;
  -- Desbloqueia restaurante
  UPDATE restaurant_settings
  SET blocked = false, blocked_reason = NULL
  WHERE user_id = p_user_id;
  -- Registra no histórico
  INSERT INTO plan_change_log (user_id, old_status, new_status, notes)
  VALUES (p_user_id, COALESCE(v_old_status, 'blocked'), 'active', COALESCE(p_notes, 'Pagamento confirmado pelo admin'));
  -- Notificação
  INSERT INTO admin_notifications (type, title, body, user_id)
  VALUES ('payment_received', 'Pagamento confirmado', COALESCE(p_notes, 'Pagamento confirmado manualmente'), p_user_id);
END;
$$;

-- ============================================================
-- FUNÇÃO: log_billing_reminder(user_id, message, channel)
-- Registra que uma cobrança foi enviada
-- ============================================================
CREATE OR REPLACE FUNCTION log_billing_reminder(p_user_id UUID, p_message TEXT DEFAULT NULL, p_channel TEXT DEFAULT 'email')
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_caller_email TEXT;
BEGIN
  SELECT email INTO v_caller_email FROM auth.users WHERE id = auth.uid();
  IF v_caller_email != 'sdavi6790@gmail.com' THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  INSERT INTO billing_reminders (user_id, sent_by, message, channel)
  VALUES (p_user_id, v_caller_email, p_message, p_channel);
END;
$$;

-- ============================================================
-- FUNÇÃO: get_billing_summary()
-- Resumo para o card de cobranças no dashboard
-- ============================================================
CREATE OR REPLACE FUNCTION get_billing_summary()
RETURNS TABLE(
  total_overdue BIGINT,
  total_overdue_amount NUMERIC,
  critical_count BIGINT,
  auto_blocked_today BIGINT
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF (SELECT email FROM auth.users WHERE id = auth.uid()) != 'sdavi6790@gmail.com' THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  RETURN QUERY
    SELECT
      COUNT(*)::BIGINT as total_overdue,
      COALESCE(SUM(p.price_brl), 0)::NUMERIC as total_overdue_amount,
      COUNT(*) FILTER (
        WHERE EXTRACT(DAY FROM NOW() - COALESCE(
          rp.overdue_since,
          CASE
            WHEN rp.status = 'trial' AND rp.trial_ends_at < NOW() THEN rp.trial_ends_at
            WHEN rp.status = 'past_due' THEN COALESCE(rp.next_billing_at, rp.created_at)
            ELSE rp.expires_at
          END
        )) >= 10
      )::BIGINT as critical_count,
      (SELECT COUNT(*) FROM plan_change_log
        WHERE new_status = 'blocked'
          AND notes LIKE 'Bloqueio automático%'
          AND changed_at > NOW() - INTERVAL '24 hours')::BIGINT as auto_blocked_today
    FROM restaurant_plans rp
    JOIN plans p ON p.id = rp.plan_id
    WHERE rp.status IN ('trial', 'past_due', 'expired')
      AND (
        (rp.status = 'trial' AND rp.trial_ends_at < NOW())
        OR rp.status = 'past_due'
        OR rp.status = 'expired'
      );
END;
$$;
