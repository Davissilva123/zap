-- Adiciona controle de trial por plano
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS trial_enabled BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS trial_days   INTEGER NOT NULL DEFAULT 7;

-- Atualiza create_trial_plan para respeitar trial_enabled e trial_days do plano
CREATE OR REPLACE FUNCTION public.create_trial_plan(p_user_id UUID)
RETURNS void AS $$
DECLARE
  v_plan_id      UUID;
  v_trial_enabled BOOLEAN;
  v_trial_days    INTEGER;
BEGIN
  -- Pega o plano 'basic' (ou o mais barato disponível)
  SELECT id, trial_enabled, trial_days
    INTO v_plan_id, v_trial_enabled, v_trial_days
    FROM public.plans
   WHERE slug = 'basic'
   LIMIT 1;

  IF v_plan_id IS NULL THEN
    SELECT id, trial_enabled, trial_days
      INTO v_plan_id, v_trial_enabled, v_trial_days
      FROM public.plans
     ORDER BY price_brl ASC
     LIMIT 1;
  END IF;

  -- Só cria trial se o plano tiver trial habilitado
  IF v_plan_id IS NOT NULL AND v_trial_enabled THEN
    INSERT INTO public.restaurant_plans (user_id, plan_id, status, trial_ends_at)
    VALUES (p_user_id, v_plan_id, 'trial', NOW() + (v_trial_days || ' days')::INTERVAL)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC para o admin ler as configurações de trial de cada plano
CREATE OR REPLACE FUNCTION public.get_plan_trial_settings()
RETURNS TABLE(slug TEXT, name TEXT, trial_enabled BOOLEAN, trial_days INTEGER) AS $$
  SELECT slug, name, trial_enabled, trial_days FROM public.plans ORDER BY price_brl ASC;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- RPC para o admin atualizar trial_enabled e trial_days de um plano
CREATE OR REPLACE FUNCTION public.update_plan_trial(p_slug TEXT, p_enabled BOOLEAN, p_days INTEGER)
RETURNS void AS $$
  UPDATE public.plans SET trial_enabled = p_enabled, trial_days = p_days WHERE slug = p_slug;
$$ LANGUAGE sql SECURITY DEFINER;
