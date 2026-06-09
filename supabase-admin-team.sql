-- =============================================================
-- Admin Team (Equipe de Operadores do Painel)
-- Rode no Supabase SQL Editor
-- =============================================================

-- 1. Tabela
CREATE TABLE IF NOT EXISTS public.admin_team (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT        UNIQUE NOT NULL,
  name        TEXT        NOT NULL,
  role        TEXT        NOT NULL DEFAULT 'limited', -- 'full' | 'limited'
  active      BOOLEAN     NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.admin_team ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "deny_all_direct" ON public.admin_team;
CREATE POLICY "deny_all_direct" ON public.admin_team FOR ALL USING (false);

-- 2. Listar equipe (super admin)
CREATE OR REPLACE FUNCTION public.get_admin_team()
RETURNS TABLE(id UUID, email TEXT, name TEXT, role TEXT, active BOOLEAN, created_at TIMESTAMPTZ)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT id, email, name, role, active, created_at
  FROM public.admin_team
  ORDER BY created_at DESC;
$$;

-- 3. Consultar role do membro logado (chamado no login)
CREATE OR REPLACE FUNCTION public.get_my_admin_role(p_email TEXT)
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT role FROM public.admin_team
  WHERE email = lower(p_email) AND active = true
  LIMIT 1;
$$;

-- 4. Adicionar / atualizar membro
CREATE OR REPLACE FUNCTION public.upsert_admin_team_member(p_email TEXT, p_name TEXT, p_role TEXT)
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  INSERT INTO public.admin_team (email, name, role)
  VALUES (lower(p_email), p_name, p_role)
  ON CONFLICT (email) DO UPDATE
    SET name = p_name, role = p_role, active = true;
$$;

-- 5. Alternar ativo/inativo
CREATE OR REPLACE FUNCTION public.toggle_admin_team_member(p_email TEXT)
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE public.admin_team SET active = NOT active
  WHERE email = lower(p_email);
$$;

-- 6. Remover membro
CREATE OR REPLACE FUNCTION public.delete_admin_team_member(p_email TEXT)
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  DELETE FROM public.admin_team WHERE email = lower(p_email);
$$;

-- 7. Retorna o user_id do super admin (para excluir das estatísticas)
CREATE OR REPLACE FUNCTION public.get_super_admin_user_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT id FROM auth.users
  WHERE email = 'sdavi6790@gmail.com'
  LIMIT 1;
$$;
