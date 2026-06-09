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

    // Valida JWT do usuário
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response(JSON.stringify({ error: 'Não autorizado' }), { status: 401, headers: corsHeaders });

    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authError || !user) return new Response(JSON.stringify({ error: 'Usuário inválido' }), { status: 401, headers: corsHeaders });

    const { sessionId } = await req.json();
    if (!sessionId) return new Response(JSON.stringify({ error: 'sessionId obrigatório' }), { status: 400, headers: corsHeaders });

    // Busca a sessão no Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription'],
    });

    if (session.payment_status !== 'paid') {
      return new Response(JSON.stringify({ activated: false, reason: 'Pagamento não confirmado' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const planSlug = session.metadata?.plan_slug ?? 'pro';
    const sub = session.subscription as Stripe.Subscription | null;
    const periodEnd = sub?.current_period_end
      ? new Date(sub.current_period_end * 1000).toISOString()
      : null;

    // Ativa o plano
    await supabase.from('restaurant_plans').upsert({
      user_id:            user.id,
      plan_name:          planSlug,
      status:             'active',
      payment_status:     'active',
      stripe_subscription_id: sub?.id ?? null,
      stripe_customer_id: session.customer as string ?? null,
      last_payment_at:    new Date().toISOString(),
      next_billing_at:    periodEnd,
      overdue_since:      null,
    }, { onConflict: 'user_id' });

    // Desbloqueia cardápio
    await supabase.from('restaurant_settings')
      .update({ blocked: false, blocked_reason: null })
      .eq('user_id', user.id);

    return new Response(JSON.stringify({ activated: true, plan: planSlug }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('stripe-verify-session error:', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});
