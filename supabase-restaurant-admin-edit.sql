-- =============================================================
-- Edição de restaurante pelo admin + campo disabled
-- Rode no Supabase SQL Editor
-- =============================================================

-- 1. Adiciona colunas de desativação
ALTER TABLE public.restaurant_settings
  ADD COLUMN IF NOT EXISTS disabled        BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS disabled_reason TEXT;

-- 2. Recria get_all_restaurants para incluir as novas colunas (SETOF já retorna tudo)
CREATE OR REPLACE FUNCTION public.get_all_restaurants()
RETURNS SETOF public.restaurant_settings
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT rs.*
  FROM public.restaurant_settings rs
  WHERE EXISTS (
    SELECT 1 FROM auth.users u
    WHERE u.id = auth.uid()
    AND (
      u.email = 'sdavi6790@gmail.com'
      OR EXISTS (SELECT 1 FROM public.admin_team t WHERE t.email = u.email AND t.active = true)
    )
  )
  ORDER BY rs.created_at DESC;
$$;

-- 3. Recria get_restaurant_detail_admin adicionando disabled e disabled_reason
CREATE OR REPLACE FUNCTION public.get_restaurant_detail_admin(p_user_id UUID)
RETURNS TABLE(
  restaurant_name TEXT, slug TEXT, phone TEXT, address TEXT,
  logo_url TEXT, cover_url TEXT, description TEXT,
  plan_slug TEXT, plan_name TEXT, plan_price NUMERIC,
  plan_status TEXT, trial_ends_at TIMESTAMPTZ,
  payment_status TEXT, stripe_subscription_id TEXT,
  order_count BIGINT, total_revenue NUMERIC, last_order_at TIMESTAMPTZ,
  blocked BOOLEAN, blocked_reason TEXT,
  disabled BOOLEAN, disabled_reason TEXT
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT (
    (SELECT email FROM auth.users WHERE id = auth.uid()) = 'sdavi6790@gmail.com'
    OR EXISTS (
      SELECT 1 FROM public.admin_team t
      WHERE t.email = (SELECT email FROM auth.users WHERE id = auth.uid())
      AND t.active = true
    )
  ) THEN
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
      p.slug::TEXT AS plan_slug,
      p.name::TEXT AS plan_name,
      p.price_brl::NUMERIC,
      rp.status::TEXT,
      rp.trial_ends_at,
      COALESCE(rp.payment_status, 'none')::TEXT,
      rp.stripe_subscription_id::TEXT,
      COALESCE((SELECT COUNT(*) FROM public.orders o WHERE o.user_id = p_user_id), 0)::BIGINT,
      COALESCE((SELECT SUM(o.total) FROM public.orders o WHERE o.user_id = p_user_id AND o.status != 'CANCELLED'), 0)::NUMERIC,
      (SELECT MAX(o.created_at) FROM public.orders o WHERE o.user_id = p_user_id),
      COALESCE(rs.blocked, false),
      rs.blocked_reason::TEXT,
      COALESCE(rs.disabled, false),
      rs.disabled_reason::TEXT
    FROM public.restaurant_settings rs
    LEFT JOIN public.restaurant_plans rp ON rp.user_id = p_user_id
    LEFT JOIN public.plans p ON p.id = rp.plan_id
    WHERE rs.user_id = p_user_id;
END;
$$;

-- 4. Editar dados do restaurante via painel admin
CREATE OR REPLACE FUNCTION public.update_restaurant_settings_admin(
  p_user_id    UUID,
  p_name       TEXT,
  p_phone      TEXT,
  p_address    TEXT,
  p_description TEXT
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT (
    (SELECT email FROM auth.users WHERE id = auth.uid()) = 'sdavi6790@gmail.com'
    OR EXISTS (
      SELECT 1 FROM public.admin_team t
      WHERE t.email = (SELECT email FROM auth.users WHERE id = auth.uid())
      AND t.active = true
    )
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  UPDATE public.restaurant_settings
  SET name = p_name, phone = p_phone, address = p_address, description = p_description
  WHERE user_id = p_user_id;
END;
$$;

-- 5. Desativar / reativar restaurante
CREATE OR REPLACE FUNCTION public.toggle_restaurant_disabled(
  p_user_id UUID,
  p_disabled BOOLEAN,
  p_reason   TEXT DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT (
    (SELECT email FROM auth.users WHERE id = auth.uid()) = 'sdavi6790@gmail.com'
    OR EXISTS (
      SELECT 1 FROM public.admin_team t
      WHERE t.email = (SELECT email FROM auth.users WHERE id = auth.uid())
      AND t.active = true
    )
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  UPDATE public.restaurant_settings
  SET disabled = p_disabled, disabled_reason = p_reason
  WHERE user_id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_restaurant_settings_admin(UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.toggle_restaurant_disabled(UUID, BOOLEAN, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_restaurant_detail_admin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_all_restaurants() TO authenticated;
