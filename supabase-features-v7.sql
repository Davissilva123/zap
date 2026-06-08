-- ============================================================
-- ZapMenu v7 — Super Admin, Plans, e melhorias
-- Execute no Supabase > SQL Editor
-- ============================================================

-- -------------------------------------------------------
-- 1. Super Admins
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS super_admins (
  email TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Adicione o email do super-admin aqui:
INSERT INTO super_admins (email) VALUES ('sdavi6790@gmail.com') ON CONFLICT DO NOTHING;

-- -------------------------------------------------------
-- 2. Função get_all_restaurants (SECURITY DEFINER)
--    Retorna todos os restaurantes apenas para super-admins
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION get_all_restaurants()
RETURNS SETOF restaurant_settings
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT rs.*
  FROM restaurant_settings rs
  WHERE EXISTS (
    SELECT 1
    FROM super_admins sa
    INNER JOIN auth.users u ON u.email = sa.email
    WHERE u.id = auth.uid()
  )
  ORDER BY rs.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION get_all_restaurants() TO authenticated;

-- -------------------------------------------------------
-- 3. Planos de assinatura
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS plans (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  slug        TEXT UNIQUE NOT NULL,
  price_brl   NUMERIC(10, 2) DEFAULT 0,
  max_items   INTEGER DEFAULT 30,    -- -1 = ilimitado
  max_operators INTEGER DEFAULT 1,  -- -1 = ilimitado
  features    JSONB DEFAULT '[]',
  active      BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO plans (name, slug, price_brl, max_items, max_operators, features) VALUES
  ('Grátis', 'free', 0, 30, 1,
   '["cardapio","qrcode","pedidos","portal_cliente"]'::jsonb),
  ('Pro', 'pro', 79, -1, -1,
   '["cardapio","qrcode","pedidos","portal_cliente","pix","whatsapp","drivers","reports","kds","coupons","operators"]'::jsonb)
ON CONFLICT (slug) DO UPDATE
  SET name = EXCLUDED.name,
      price_brl = EXCLUDED.price_brl,
      features = EXCLUDED.features;

-- -------------------------------------------------------
-- 4. Plano por restaurante
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS restaurant_plans (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id    UUID NOT NULL REFERENCES plans(id),
  status     TEXT NOT NULL DEFAULT 'active',  -- active, cancelled, past_due
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE restaurant_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner_restaurant_plans" ON restaurant_plans;
CREATE POLICY "owner_restaurant_plans" ON restaurant_plans
  FOR ALL USING (auth.uid() = user_id);

-- Super-admins podem ver todos os planos
DROP POLICY IF EXISTS "superadmin_restaurant_plans" ON restaurant_plans;
CREATE POLICY "superadmin_restaurant_plans" ON restaurant_plans
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM super_admins sa
      INNER JOIN auth.users u ON u.email = sa.email
      WHERE u.id = auth.uid()
    )
  );

-- -------------------------------------------------------
-- 5. Função get_restaurant_plan
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION get_restaurant_plan(p_user_id UUID DEFAULT auth.uid())
RETURNS TABLE(plan_name TEXT, plan_slug TEXT, max_items INTEGER, max_operators INTEGER, features JSONB, expires_at TIMESTAMPTZ)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.name, p.slug, p.max_items, p.max_operators, p.features, rp.expires_at
  FROM restaurant_plans rp
  INNER JOIN plans p ON p.id = rp.plan_id
  WHERE rp.user_id = p_user_id
    AND rp.status = 'active'
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION get_restaurant_plan(UUID) TO authenticated;

-- -------------------------------------------------------
-- 6. Super-admins podem ler/alterar planos de restaurantes
-- -------------------------------------------------------
DROP POLICY IF EXISTS "superadmin_plans_read" ON plans;
CREATE POLICY "superadmin_plans_read" ON plans FOR SELECT USING (TRUE);

ALTER TABLE plans ENABLE ROW LEVEL SECURITY;

-- -------------------------------------------------------
-- 7. Função set_restaurant_plan (super-admin only)
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION set_restaurant_plan(
  p_target_user_id UUID,
  p_plan_slug TEXT,
  p_expires_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan_id UUID;
BEGIN
  -- Verificar se é super-admin
  IF NOT EXISTS (
    SELECT 1 FROM super_admins sa
    INNER JOIN auth.users u ON u.email = sa.email
    WHERE u.id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT id INTO v_plan_id FROM plans WHERE slug = p_plan_slug AND active = TRUE;
  IF v_plan_id IS NULL THEN
    RAISE EXCEPTION 'Plano não encontrado: %', p_plan_slug;
  END IF;

  INSERT INTO restaurant_plans (user_id, plan_id, status, expires_at)
  VALUES (p_target_user_id, v_plan_id, 'active', p_expires_at)
  ON CONFLICT (user_id) DO UPDATE
    SET plan_id = EXCLUDED.plan_id,
        status = 'active',
        expires_at = EXCLUDED.expires_at;
END;
$$;

GRANT EXECUTE ON FUNCTION set_restaurant_plan(UUID, TEXT, TIMESTAMPTZ) TO authenticated;

-- -------------------------------------------------------
-- FIM DO SCRIPT v7
-- -------------------------------------------------------
