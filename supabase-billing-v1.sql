-- ============================================================
-- supabase-billing-v1.sql
-- Cobrança, feature flags, notas, notificações, analytics
-- Execute APÓS supabase-admin-v3.sql
-- ============================================================

-- ---- Notas Internas (admin → restaurante) ----
CREATE TABLE IF NOT EXISTS restaurant_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---- Feature Flags por Restaurante ----
CREATE TABLE IF NOT EXISTS restaurant_feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  flag_name TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, flag_name)
);

-- ---- Notificações Internas (para o super admin) ----
CREATE TABLE IF NOT EXISTS admin_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---- Cupons de Assinatura SaaS ----
CREATE TABLE IF NOT EXISTS subscription_coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  discount_type TEXT NOT NULL DEFAULT 'percent',
  discount_value NUMERIC(10,2) NOT NULL,
  max_uses INTEGER,
  uses_count INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---- Histórico MRR (snapshot mensal) ----
CREATE TABLE IF NOT EXISTS mrr_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month TEXT NOT NULL UNIQUE,
  mrr_value NUMERIC(10,2) NOT NULL DEFAULT 0,
  active_paid INTEGER NOT NULL DEFAULT 0,
  in_trial INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---- Colunas Stripe em restaurant_plans ----
ALTER TABLE restaurant_plans
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_price_id TEXT,
  ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS last_payment_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS next_billing_at TIMESTAMPTZ;

-- ---- Onboarding tracking em restaurant_settings ----
ALTER TABLE restaurant_settings
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;

-- ============================================================
-- RLS: Só via SECURITY DEFINER functions
-- ============================================================
ALTER TABLE restaurant_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE mrr_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "no_direct_access_notes" ON restaurant_notes;
DROP POLICY IF EXISTS "no_direct_access_flags" ON restaurant_feature_flags;
DROP POLICY IF EXISTS "no_direct_access_notifications" ON admin_notifications;
DROP POLICY IF EXISTS "no_direct_access_coupons" ON subscription_coupons;
DROP POLICY IF EXISTS "no_direct_access_mrr_history" ON mrr_history;

CREATE POLICY "no_direct_access_notes" ON restaurant_notes FOR ALL USING (false);
CREATE POLICY "no_direct_access_flags" ON restaurant_feature_flags FOR ALL USING (false);
CREATE POLICY "no_direct_access_notifications" ON admin_notifications FOR ALL USING (false);
CREATE POLICY "no_direct_access_coupons" ON subscription_coupons FOR ALL USING (false);
CREATE POLICY "no_direct_access_mrr_history" ON mrr_history FOR ALL USING (false);

-- ============================================================
-- ANALYTICS FUNCTIONS
-- ============================================================

-- get_mrr_by_plan(): MRR detalhado por plano
CREATE OR REPLACE FUNCTION get_mrr_by_plan()
RETURNS TABLE(plan_slug TEXT, plan_name TEXT, plan_price NUMERIC, active_count BIGINT, mrr NUMERIC)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF (SELECT email FROM auth.users WHERE id = auth.uid()) != 'sdavi6790@gmail.com' THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  RETURN QUERY
    SELECT
      p.slug::TEXT,
      p.name::TEXT,
      p.price_brl::NUMERIC,
      COUNT(rp.user_id)::BIGINT,
      (COUNT(rp.user_id) * p.price_brl)::NUMERIC
    FROM plans p
    LEFT JOIN restaurant_plans rp ON rp.plan_id = p.id AND rp.status = 'active'
    GROUP BY p.id, p.slug, p.name, p.price_brl
    ORDER BY p.price_brl DESC;
END;
$$;

-- get_mrr_history(): Histórico mensal de MRR (últimos 6 meses)
CREATE OR REPLACE FUNCTION get_mrr_history()
RETURNS TABLE(month TEXT, mrr_value NUMERIC, active_paid BIGINT, in_trial BIGINT)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF (SELECT email FROM auth.users WHERE id = auth.uid()) != 'sdavi6790@gmail.com' THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF EXISTS (SELECT 1 FROM mrr_history LIMIT 1) THEN
    RETURN QUERY
      SELECT h.month, h.mrr_value, h.active_paid::BIGINT, h.in_trial::BIGINT
      FROM mrr_history h ORDER BY h.month ASC LIMIT 12;
  ELSE
    RETURN QUERY
      SELECT
        to_char(gs, 'YYYY-MM')::TEXT as month,
        COALESCE((
          SELECT SUM(p.price_brl)
          FROM restaurant_plans rp
          JOIN plans p ON p.id = rp.plan_id
          WHERE rp.status = 'active'
            AND rp.created_at <= (gs + INTERVAL '1 month')
        ), 0)::NUMERIC as mrr_value,
        COALESCE((
          SELECT COUNT(*) FROM restaurant_plans rp
          WHERE rp.status = 'active'
            AND rp.created_at <= (gs + INTERVAL '1 month')
        ), 0)::BIGINT as active_paid,
        COALESCE((
          SELECT COUNT(*) FROM restaurant_plans rp
          WHERE rp.status = 'trial'
            AND rp.trial_starts_at <= (gs + INTERVAL '1 month')
        ), 0)::BIGINT as in_trial
      FROM generate_series(
        date_trunc('month', NOW() - INTERVAL '5 months'),
        date_trunc('month', NOW()),
        INTERVAL '1 month'
      ) gs
      ORDER BY gs ASC;
  END IF;
END;
$$;

-- get_onboarding_funnel(): Funil de onboarding
CREATE OR REPLACE FUNCTION get_onboarding_funnel()
RETURNS TABLE(stage TEXT, count BIGINT)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF (SELECT email FROM auth.users WHERE id = auth.uid()) != 'sdavi6790@gmail.com' THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  RETURN QUERY
    SELECT 'cadastrou'::TEXT,
      (SELECT COUNT(*) FROM auth.users WHERE raw_app_meta_data->>'provider' IS NOT NULL)::BIGINT
    UNION ALL
    SELECT 'criou_restaurante'::TEXT, (SELECT COUNT(*) FROM restaurant_settings)::BIGINT
    UNION ALL
    SELECT 'personalizou'::TEXT, (SELECT COUNT(*) FROM restaurant_settings WHERE onboarding_completed_at IS NOT NULL)::BIGINT
    UNION ALL
    SELECT 'fez_pedido'::TEXT, (SELECT COUNT(DISTINCT user_id) FROM orders)::BIGINT;
END;
$$;

-- get_churn_report(): Relatório de churn com motivos
CREATE OR REPLACE FUNCTION get_churn_report()
RETURNS TABLE(user_id UUID, restaurant_name TEXT, old_plan TEXT, churn_reason TEXT, churned_at TIMESTAMPTZ)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF (SELECT email FROM auth.users WHERE id = auth.uid()) != 'sdavi6790@gmail.com' THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  RETURN QUERY
    SELECT
      pcl.user_id,
      COALESCE(rs.name, pcl.user_id::TEXT)::TEXT as restaurant_name,
      COALESCE(pcl.old_plan_slug, 'trial')::TEXT as old_plan,
      COALESCE(pcl.notes, 'Não informado')::TEXT as churn_reason,
      pcl.changed_at
    FROM plan_change_log pcl
    LEFT JOIN restaurant_settings rs ON rs.user_id = pcl.user_id
    WHERE pcl.new_status IN ('cancelled', 'churned')
    ORDER BY pcl.changed_at DESC;
END;
$$;

-- ============================================================
-- NOTAS INTERNAS
-- ============================================================

CREATE OR REPLACE FUNCTION get_restaurant_notes(p_user_id UUID)
RETURNS TABLE(id UUID, note TEXT, created_by TEXT, created_at TIMESTAMPTZ)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF (SELECT email FROM auth.users WHERE id = auth.uid()) != 'sdavi6790@gmail.com' THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  RETURN QUERY
    SELECT n.id, n.note, n.created_by, n.created_at
    FROM restaurant_notes n
    WHERE n.user_id = p_user_id
    ORDER BY n.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION add_restaurant_note(p_user_id UUID, p_note TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_caller_email TEXT;
BEGIN
  SELECT email INTO v_caller_email FROM auth.users WHERE id = auth.uid();
  IF v_caller_email != 'sdavi6790@gmail.com' THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  INSERT INTO restaurant_notes (user_id, note, created_by) VALUES (p_user_id, p_note, v_caller_email);
END;
$$;

CREATE OR REPLACE FUNCTION delete_restaurant_note(p_note_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF (SELECT email FROM auth.users WHERE id = auth.uid()) != 'sdavi6790@gmail.com' THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  DELETE FROM restaurant_notes WHERE id = p_note_id;
END;
$$;

-- ============================================================
-- FEATURE FLAGS
-- ============================================================

CREATE OR REPLACE FUNCTION get_feature_flags(p_user_id UUID)
RETURNS TABLE(flag_name TEXT, enabled BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF (SELECT email FROM auth.users WHERE id = auth.uid()) != 'sdavi6790@gmail.com' THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  RETURN QUERY SELECT f.flag_name, f.enabled FROM restaurant_feature_flags f WHERE f.user_id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION set_feature_flag(p_user_id UUID, p_flag_name TEXT, p_enabled BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF (SELECT email FROM auth.users WHERE id = auth.uid()) != 'sdavi6790@gmail.com' THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  INSERT INTO restaurant_feature_flags (user_id, flag_name, enabled)
  VALUES (p_user_id, p_flag_name, p_enabled)
  ON CONFLICT (user_id, flag_name) DO UPDATE SET enabled = EXCLUDED.enabled;
END;
$$;

-- ============================================================
-- NOTIFICAÇÕES INTERNAS
-- ============================================================

CREATE OR REPLACE FUNCTION get_admin_notifications()
RETURNS TABLE(id UUID, type TEXT, title TEXT, body TEXT, user_id UUID, read BOOLEAN, created_at TIMESTAMPTZ)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF (SELECT email FROM auth.users WHERE id = auth.uid()) != 'sdavi6790@gmail.com' THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  RETURN QUERY
    SELECT n.id, n.type, n.title, n.body, n.user_id, n.read, n.created_at
    FROM admin_notifications n
    ORDER BY n.created_at DESC LIMIT 50;
END;
$$;

CREATE OR REPLACE FUNCTION mark_notification_read(p_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF (SELECT email FROM auth.users WHERE id = auth.uid()) != 'sdavi6790@gmail.com' THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  UPDATE admin_notifications SET read = true WHERE id = p_id;
END;
$$;

CREATE OR REPLACE FUNCTION mark_all_notifications_read()
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF (SELECT email FROM auth.users WHERE id = auth.uid()) != 'sdavi6790@gmail.com' THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  UPDATE admin_notifications SET read = true WHERE read = false;
END;
$$;

-- Trigger: notifica admin quando novo restaurante é criado
CREATE OR REPLACE FUNCTION notify_new_restaurant()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO admin_notifications (type, title, body, user_id)
  VALUES ('new_signup', 'Novo restaurante cadastrado', NEW.name, NEW.user_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_new_restaurant ON restaurant_settings;
CREATE TRIGGER on_new_restaurant
  AFTER INSERT ON restaurant_settings
  FOR EACH ROW EXECUTE FUNCTION notify_new_restaurant();

-- Gera notificações de trial expirando (chame manualmente ou via cron)
CREATE OR REPLACE FUNCTION generate_trial_expiry_notifications()
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_count INTEGER := 0;
  v_rec RECORD;
BEGIN
  FOR v_rec IN
    SELECT rp.user_id, rs.name as restaurant_name, rp.trial_ends_at
    FROM restaurant_plans rp
    JOIN restaurant_settings rs ON rs.user_id = rp.user_id
    WHERE rp.status = 'trial'
      AND rp.trial_ends_at BETWEEN NOW() AND NOW() + INTERVAL '3 days'
      AND NOT EXISTS (
        SELECT 1 FROM admin_notifications an
        WHERE an.user_id = rp.user_id
          AND an.type = 'trial_expiring'
          AND an.created_at > NOW() - INTERVAL '24 hours'
      )
  LOOP
    INSERT INTO admin_notifications (type, title, body, user_id)
    VALUES (
      'trial_expiring',
      'Trial expirando em breve',
      format('"%s" expira em %s', v_rec.restaurant_name, to_char(v_rec.trial_ends_at, 'DD/MM/YYYY')),
      v_rec.user_id
    );
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

-- ============================================================
-- CUPONS DE ASSINATURA
-- ============================================================

CREATE OR REPLACE FUNCTION get_subscription_coupons()
RETURNS TABLE(id UUID, code TEXT, discount_type TEXT, discount_value NUMERIC, max_uses INTEGER, uses_count INTEGER, active BOOLEAN, expires_at TIMESTAMPTZ, created_at TIMESTAMPTZ)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF (SELECT email FROM auth.users WHERE id = auth.uid()) != 'sdavi6790@gmail.com' THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  RETURN QUERY
    SELECT c.id, c.code, c.discount_type, c.discount_value, c.max_uses, c.uses_count, c.active, c.expires_at, c.created_at
    FROM subscription_coupons c ORDER BY c.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION create_subscription_coupon(
  p_code TEXT,
  p_discount_type TEXT,
  p_discount_value NUMERIC,
  p_max_uses INTEGER DEFAULT NULL,
  p_expires_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF (SELECT email FROM auth.users WHERE id = auth.uid()) != 'sdavi6790@gmail.com' THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  INSERT INTO subscription_coupons (code, discount_type, discount_value, max_uses, expires_at)
  VALUES (upper(p_code), p_discount_type, p_discount_value, p_max_uses, p_expires_at);
END;
$$;

CREATE OR REPLACE FUNCTION toggle_subscription_coupon(p_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF (SELECT email FROM auth.users WHERE id = auth.uid()) != 'sdavi6790@gmail.com' THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  UPDATE subscription_coupons SET active = NOT active WHERE id = p_id;
END;
$$;

CREATE OR REPLACE FUNCTION delete_subscription_coupon(p_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF (SELECT email FROM auth.users WHERE id = auth.uid()) != 'sdavi6790@gmail.com' THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  DELETE FROM subscription_coupons WHERE id = p_id;
END;
$$;

-- ============================================================
-- DETALHE DE RESTAURANTE (impersonação read-only)
-- ============================================================

CREATE OR REPLACE FUNCTION get_restaurant_detail_admin(p_user_id UUID)
RETURNS TABLE(
  restaurant_name TEXT, slug TEXT, phone TEXT, address TEXT,
  logo_url TEXT, cover_url TEXT, description TEXT,
  plan_slug TEXT, plan_name TEXT, plan_price NUMERIC,
  plan_status TEXT, trial_ends_at TIMESTAMPTZ,
  payment_status TEXT, stripe_subscription_id TEXT,
  order_count BIGINT, total_revenue NUMERIC, last_order_at TIMESTAMPTZ,
  blocked BOOLEAN, blocked_reason TEXT
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF (SELECT email FROM auth.users WHERE id = auth.uid()) != 'sdavi6790@gmail.com' THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  RETURN QUERY
    SELECT
      rs.name::TEXT,
      rs.slug::TEXT,
      rs.phone::TEXT,
      rs.address::TEXT,
      rs.logo_url::TEXT,
      rs.cover_url::TEXT,
      rs.description::TEXT,
      p.slug::TEXT as plan_slug,
      p.name::TEXT as plan_name,
      p.price_brl::NUMERIC,
      rp.status::TEXT,
      rp.trial_ends_at,
      COALESCE(rp.payment_status, 'none')::TEXT,
      rp.stripe_subscription_id::TEXT,
      COALESCE((SELECT COUNT(*) FROM orders o WHERE o.user_id = p_user_id), 0)::BIGINT,
      COALESCE((SELECT SUM(o.total) FROM orders o WHERE o.user_id = p_user_id AND o.status != 'CANCELLED'), 0)::NUMERIC,
      (SELECT MAX(o.created_at) FROM orders o WHERE o.user_id = p_user_id),
      COALESCE(rs.blocked, false),
      rs.blocked_reason::TEXT
    FROM restaurant_settings rs
    LEFT JOIN restaurant_plans rp ON rp.user_id = p_user_id
    LEFT JOIN plans p ON p.id = rp.plan_id
    WHERE rs.user_id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION get_restaurant_orders_admin(p_user_id UUID)
RETURNS TABLE(
  id UUID, status TEXT, total NUMERIC, customer_name TEXT,
  delivery_type TEXT, payment_method TEXT, created_at TIMESTAMPTZ
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF (SELECT email FROM auth.users WHERE id = auth.uid()) != 'sdavi6790@gmail.com' THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  RETURN QUERY
    SELECT o.id, o.status, o.total::NUMERIC, o.customer_name, o.delivery_type, o.payment_method, o.created_at
    FROM orders o
    WHERE o.user_id = p_user_id
    ORDER BY o.created_at DESC
    LIMIT 30;
END;
$$;

-- Snapshot manual do MRR atual (chame todo mês para histórico)
CREATE OR REPLACE FUNCTION snapshot_mrr()
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_month TEXT := to_char(NOW(), 'YYYY-MM');
  v_mrr NUMERIC;
  v_active INTEGER;
  v_trial INTEGER;
BEGIN
  IF (SELECT email FROM auth.users WHERE id = auth.uid()) != 'sdavi6790@gmail.com' THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  SELECT COALESCE(SUM(p.price_brl), 0) INTO v_mrr
  FROM restaurant_plans rp JOIN plans p ON p.id = rp.plan_id WHERE rp.status = 'active';
  SELECT COUNT(*) INTO v_active FROM restaurant_plans WHERE status = 'active';
  SELECT COUNT(*) INTO v_trial FROM restaurant_plans WHERE status = 'trial';
  INSERT INTO mrr_history (month, mrr_value, active_paid, in_trial)
  VALUES (v_month, v_mrr, v_active, v_trial)
  ON CONFLICT (month) DO UPDATE SET mrr_value = EXCLUDED.mrr_value, active_paid = EXCLUDED.active_paid, in_trial = EXCLUDED.in_trial;
END;
$$;

-- ============================================================
-- Inserir cupom de exemplo
-- ============================================================
INSERT INTO subscription_coupons (code, discount_type, discount_value, max_uses, active)
VALUES ('PRIMEIRO30', 'percent', 30, 100, true)
ON CONFLICT (code) DO NOTHING;

INSERT INTO subscription_coupons (code, discount_type, discount_value, max_uses, active)
VALUES ('ANUAL20', 'percent', 20, NULL, true)
ON CONFLICT (code) DO NOTHING;
