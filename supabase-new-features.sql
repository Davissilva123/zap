-- =========================================================
-- BLOCO 1: Tabelas novas (executar primeiro)
-- =========================================================

-- Combos / kits
CREATE TABLE IF NOT EXISTS public.combos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  emoji TEXT NOT NULL DEFAULT '🍱',
  description TEXT NOT NULL DEFAULT '',
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  items JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.combos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "combos_owner" ON public.combos;
CREATE POLICY "combos_owner" ON public.combos
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Promocoes por horario
CREATE TABLE IF NOT EXISTS public.promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  days_of_week INTEGER[] NOT NULL DEFAULT '{1,2,3,4,5}',
  start_time TEXT NOT NULL DEFAULT '17:00',
  end_time TEXT NOT NULL DEFAULT '19:00',
  discount_percent NUMERIC(5,2) NOT NULL DEFAULT 20,
  target_type TEXT NOT NULL DEFAULT 'all',
  target_id UUID,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "promotions_owner" ON public.promotions;
CREATE POLICY "promotions_owner" ON public.promotions
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Sessoes de caixa
CREATE TABLE IF NOT EXISTS public.cash_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  opened_at TIMESTAMPTZ DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  opening_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  closing_amount NUMERIC(10,2),
  total_sales NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_withdrawals NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_deposits NUMERIC(10,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open',
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.cash_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cash_sessions_owner" ON public.cash_sessions;
CREATE POLICY "cash_sessions_owner" ON public.cash_sessions
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Entradas de caixa (sangria, suprimento, venda manual)
CREATE TABLE IF NOT EXISTS public.cash_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.cash_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'sale',
  amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  description TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.cash_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cash_entries_owner" ON public.cash_entries;
CREATE POLICY "cash_entries_owner" ON public.cash_entries
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Movimentacoes de estoque
CREATE TABLE IF NOT EXISTS public.stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  menu_item_id UUID NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
  delta INTEGER NOT NULL DEFAULT 0,
  reason TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "stock_movements_owner" ON public.stock_movements;
CREATE POLICY "stock_movements_owner" ON public.stock_movements
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Coluna de GPS na tabela drivers (para rastreamento)
ALTER TABLE public.drivers
  ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS last_location_at TIMESTAMPTZ;

-- =========================================================
-- BLOCO 2: Grants de acesso (executar depois do bloco 1)
-- =========================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.combos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.promotions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cash_sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cash_entries TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_movements TO authenticated;

-- =========================================================
-- BLOCO 3: RPC para rastreamento de entregador pelo cliente
-- =========================================================

CREATE OR REPLACE FUNCTION public.get_driver_location_for_order(p_order_id UUID)
RETURNS TABLE(lat DOUBLE PRECISION, lng DOUBLE PRECISION, driver_name TEXT, last_location_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
    SELECT d.lat, d.lng, d.name AS driver_name, d.last_location_at
    FROM orders o
    JOIN drivers d ON d.id = o.driver_id
    WHERE o.id = p_order_id
      AND o.status = 'DELIVERING'
      AND d.lat IS NOT NULL
      AND d.lng IS NOT NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_driver_location_for_order(UUID) TO anon, authenticated;
