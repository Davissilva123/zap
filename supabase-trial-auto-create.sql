-- Função que cria o plano de trial para um novo usuário
CREATE OR REPLACE FUNCTION public.create_trial_plan(p_user_id UUID)
RETURNS void AS $$
DECLARE
  v_plan_id UUID;
BEGIN
  -- Usa o plano 'basic' como padrão, ou o mais barato se basic não existir
  SELECT id INTO v_plan_id FROM public.plans WHERE slug = 'basic' LIMIT 1;
  IF v_plan_id IS NULL THEN
    SELECT id INTO v_plan_id FROM public.plans ORDER BY price_brl ASC LIMIT 1;
  END IF;

  IF v_plan_id IS NOT NULL THEN
    INSERT INTO public.restaurant_plans (user_id, plan_id, status, trial_ends_at)
    VALUES (p_user_id, v_plan_id, 'trial', NOW() + INTERVAL '7 days')
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função intermediária chamada pelo trigger
CREATE OR REPLACE FUNCTION public.handle_new_user_trial()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM public.create_trial_plan(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: ao criar usuário no Supabase Auth, cria o trial automaticamente
DROP TRIGGER IF EXISTS on_auth_user_created_trial ON auth.users;
CREATE TRIGGER on_auth_user_created_trial
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_trial();
