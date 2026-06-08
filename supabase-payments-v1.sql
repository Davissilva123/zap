-- =====================================================
-- HISTÓRICO DE PAGAMENTOS POR RESTAURANTE
-- Execute no Supabase > SQL Editor
-- =====================================================

-- Tabela de histórico de pagamentos
CREATE TABLE IF NOT EXISTS payment_history (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount       NUMERIC(10,2) NOT NULL DEFAULT 0,
  method       TEXT NOT NULL DEFAULT 'manual', -- 'pix', 'card', 'boleto', 'manual'
  status       TEXT NOT NULL DEFAULT 'paid',   -- 'paid', 'pending', 'overdue'
  reference    TEXT,                            -- número do mês, ex: '2026-06'
  notes        TEXT,
  paid_at      TIMESTAMPTZ,
  due_at       TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  created_by   UUID REFERENCES auth.users(id)  -- admin que registrou
);

CREATE INDEX IF NOT EXISTS idx_payment_history_user ON payment_history(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_history_status ON payment_history(status);

-- Chave PIX da plataforma
INSERT INTO platform_settings (key, value, updated_at)
VALUES ('pix_key', '', NOW())
ON CONFLICT (key) DO NOTHING;

INSERT INTO platform_settings (key, value, updated_at)
VALUES ('pix_key_type', 'cpf', NOW())  -- cpf, cnpj, email, phone, random
ON CONFLICT (key) DO NOTHING;

INSERT INTO platform_settings (key, value, updated_at)
VALUES ('pix_beneficiary', 'ZapMenu', NOW())
ON CONFLICT (key) DO NOTHING;

-- Leitura das configurações PIX (público)
CREATE OR REPLACE FUNCTION get_pix_settings()
RETURNS TABLE (pix_key TEXT, pix_key_type TEXT, pix_beneficiary TEXT)
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    MAX(CASE WHEN key = 'pix_key'         THEN value END),
    MAX(CASE WHEN key = 'pix_key_type'    THEN value END),
    MAX(CASE WHEN key = 'pix_beneficiary' THEN value END)
  FROM platform_settings
  WHERE key IN ('pix_key', 'pix_key_type', 'pix_beneficiary');
$$;
GRANT EXECUTE ON FUNCTION get_pix_settings() TO authenticated, anon;

-- Atualização das configs PIX (só super admin)
CREATE OR REPLACE FUNCTION set_pix_settings(p_key TEXT, p_key_type TEXT, p_beneficiary TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_email TEXT;
BEGIN
  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();
  IF v_email NOT IN (SELECT email FROM super_admins) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  INSERT INTO platform_settings (key, value, updated_at) VALUES ('pix_key', p_key, NOW())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
  INSERT INTO platform_settings (key, value, updated_at) VALUES ('pix_key_type', p_key_type, NOW())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
  INSERT INTO platform_settings (key, value, updated_at) VALUES ('pix_beneficiary', p_beneficiary, NOW())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
END;
$$;
GRANT EXECUTE ON FUNCTION set_pix_settings(TEXT, TEXT, TEXT) TO authenticated;

-- Histórico de pagamentos de um restaurante (admin)
CREATE OR REPLACE FUNCTION get_restaurant_payment_history(p_user_id UUID)
RETURNS TABLE (
  id         UUID,
  amount     NUMERIC,
  method     TEXT,
  status     TEXT,
  reference  TEXT,
  notes      TEXT,
  paid_at    TIMESTAMPTZ,
  due_at     TIMESTAMPTZ,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_email TEXT;
BEGIN
  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();
  IF v_email NOT IN (SELECT email FROM super_admins) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  RETURN QUERY
  SELECT ph.id, ph.amount, ph.method, ph.status, ph.reference,
         ph.notes, ph.paid_at, ph.due_at, ph.created_at
  FROM payment_history ph
  WHERE ph.user_id = p_user_id
  ORDER BY ph.created_at DESC
  LIMIT 50;
END;
$$;
GRANT EXECUTE ON FUNCTION get_restaurant_payment_history(UUID) TO authenticated;

-- Registra pagamento manualmente (admin)
CREATE OR REPLACE FUNCTION record_payment(
  p_user_id   UUID,
  p_amount    NUMERIC,
  p_method    TEXT DEFAULT 'pix',
  p_notes     TEXT DEFAULT NULL,
  p_reference TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_email TEXT;
  v_id    UUID;
BEGIN
  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();
  IF v_email NOT IN (SELECT email FROM super_admins) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  INSERT INTO payment_history (user_id, amount, method, status, reference, notes, paid_at, created_by)
  VALUES (p_user_id, p_amount, p_method, 'paid', p_reference, p_notes, NOW(), auth.uid())
  RETURNING id INTO v_id;

  -- Atualiza plano como ativo
  UPDATE restaurant_plans SET
    status = 'active', payment_status = 'active',
    last_payment_at = NOW(),
    next_billing_at = NOW() + INTERVAL '30 days',
    overdue_since = NULL
  WHERE user_id = p_user_id;

  UPDATE restaurant_settings SET is_blocked = FALSE WHERE user_id = p_user_id;

  RETURN v_id;
END;
$$;
GRANT EXECUTE ON FUNCTION record_payment(UUID, NUMERIC, TEXT, TEXT, TEXT) TO authenticated;
