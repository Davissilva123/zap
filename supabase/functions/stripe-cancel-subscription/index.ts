import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, { apiVersion: '2024-06-20' });

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response(JSON.stringify({ error: 'Não autorizado' }), { status: 401, headers: corsHeaders });

    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authError || !user) return new Response(JSON.stringify({ error: 'Usuário inválido' }), { status: 401, headers: corsHeaders });

    // Busca o subscription_id do usuário
    const { data: plan, error: planError } = await supabase
      .from('restaurant_plans')
      .select('stripe_subscription_id, status')
      .eq('user_id', user.id)
      .maybeSingle();

    if (planError || !plan) {
      return new Response(JSON.stringify({ error: 'Plano não encontrado' }), { status: 404, headers: corsHeaders });
    }

    if (!plan.stripe_subscription_id) {
      return new Response(JSON.stringify({ error: 'Nenhuma assinatura Stripe ativa para cancelar' }), { status: 400, headers: corsHeaders });
    }

    // Cancela no Stripe ao fim do período (não imediatamente)
    await stripe.subscriptions.update(plan.stripe_subscription_id, {
      cancel_at_period_end: true,
    });

    // Marca como cancelled no banco
    await supabase.from('restaurant_plans')
      .update({ status: 'cancelled', payment_status: 'cancelled' })
      .eq('user_id', user.id);

    return new Response(JSON.stringify({ cancelled: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('stripe-cancel-subscription error:', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});
