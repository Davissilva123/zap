import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, { apiVersion: '2024-06-20' });

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Mapeamento: slug do plano → Price ID do Stripe (configure no painel Stripe)
const PRICE_IDS: Record<string, string> = {
  basic:   Deno.env.get('STRIPE_PRICE_BASIC')   ?? '',
  pro:     Deno.env.get('STRIPE_PRICE_PRO')      ?? '',
  premium: Deno.env.get('STRIPE_PRICE_PREMIUM')  ?? '',
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

    const { planSlug, successUrl, cancelUrl } = await req.json();
    const priceId = PRICE_IDS[planSlug];
    if (!priceId) return new Response(JSON.stringify({ error: `Plano "${planSlug}" não configurado no Stripe` }), { status: 400, headers: corsHeaders });

    // Busca ou cria customer no Stripe
    const { data: plan } = await supabase
      .from('restaurant_plans')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .maybeSingle();

    let customerId = plan?.stripe_customer_id as string | undefined;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email!,
        metadata: { user_id: user.id },
      });
      customerId = customer.id;
      await supabase.from('restaurant_plans').upsert({ user_id: user.id, stripe_customer_id: customerId }, { onConflict: 'user_id' });
    }

    // Cria sessão de checkout — sem trial (o trial já foi dado pelo ZapMenu)
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card', 'boleto'],
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        metadata: { user_id: user.id, plan_slug: planSlug },
      },
      success_url: successUrl ?? `${req.headers.get('origin')}/dashboard?checkout=success`,
      cancel_url:  cancelUrl  ?? `${req.headers.get('origin')}/dashboard?checkout=cancel`,
      metadata: { user_id: user.id, plan_slug: planSlug },
    });

    return new Response(JSON.stringify({ url: session.url, sessionId: session.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('stripe-create-checkout error:', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});
