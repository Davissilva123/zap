-- =====================================================
-- Funções para leitura e edição de preços dos planos
-- Execute no Supabase > SQL Editor
-- =====================================================

-- Leitura pública dos planos (sem RLS)
CREATE OR REPLACE FUNCTION get_platform_plans()
RETURNS TABLE (
  slug       TEXT,
  name       TEXT,
  price_brl  NUMERIC
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT slug, name, price_brl
  FROM plans
  WHERE slug IN ('basic', 'pro', 'premium')
  ORDER BY price_brl ASC;
$$;

GRANT EXECUTE ON FUNCTION get_platform_plans() TO authenticated, anon;

-- Atualização de preço — só super admin pode chamar
-- (valida pelo email da sessão atual)
CREATE OR REPLACE FUNCTION update_plan_price(p_slug TEXT, p_price NUMERIC)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT;
BEGIN
  -- Pega o email do usuário autenticado
  SELECT email INTO v_email
  FROM auth.users
  WHERE id = auth.uid();

  -- Só permite se for o super admin
  IF v_email NOT IN (
    SELECT email FROM super_admins
  ) THEN
    RAISE EXCEPTION 'Acesso negado: apenas o super admin pode alterar preços';
  END IF;

  UPDATE plans
  SET price_brl = p_price
  WHERE slug = p_slug;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Plano "%" não encontrado', p_slug;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION update_plan_price(TEXT, NUMERIC) TO authenticated;
