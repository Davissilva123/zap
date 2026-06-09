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
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // fallback: +30 dias

    const customerId = typeof session.customer === 'string'
      ? session.customer
      : (session.customer as any)?.id ?? null;

    // Ativa o plano via SECURITY DEFINER (garante que bypassa RLS corretamente)
    const { error: rpcError } = await supabase.rpc('activate_stripe_plan', {
      p_user_id:         user.id,
      p_plan_slug:       planSlug,
      p_stripe_sub_id:   sub?.id ?? null,
      p_stripe_customer: customerId,
      p_next_billing_at: periodEnd,
    });

    if (rpcError) {
      console.error('activate_stripe_plan RPC error:', rpcError);
      return new Response(JSON.stringify({ activated: false, error: rpcError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Registra no histórico (evita duplicata se webhook já inseriu)
    const { data: existing } = await supabase
      .from('payment_history')
      .select('id')
      .eq('reference', sessionId)
      .maybeSingle();

    if (!existing) {
      const amount = (session.amount_total ?? 0) / 100;
      await supabase.from('payment_history').insert({
        user_id:    user.id,
        amount,
        method:     'stripe',
        status:     'paid',
        reference:  sessionId,
        notes:      `Pagamento via Stripe Checkout — Plano ${planSlug}`,
        paid_at:    new Date().toISOString(),
        created_by: null,
      });
    }

    return new Response(JSON.stringify({ activated: true, plan: planSlug }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('stripe-verify-session error:', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});
