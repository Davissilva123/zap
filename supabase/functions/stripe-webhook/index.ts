import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, { apiVersion: '2024-06-20' });
const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

// Mapeia status do Stripe → status do restaurant_plans
function mapStatus(stripeStatus: string): string {
  switch (stripeStatus) {
    case 'active':   return 'active';
    case 'trialing': return 'trial';
    case 'past_due': return 'past_due';
    case 'canceled': return 'cancelled';
    case 'unpaid':   return 'past_due';
    default:         return 'expired';
  }
}

Deno.serve(async (req) => {
  const body = await req.text();
  const sig  = req.headers.get('stripe-signature');

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, sig!, webhookSecret);
  } catch (err: any) {
    console.error('Webhook signature inválida:', err.message);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  try {
    switch (event.type) {
      // ── Assinatura criada / atualizada ───────────────────────────────
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        const userId   = sub.metadata?.user_id;
        const planSlug = sub.metadata?.plan_slug ?? 'basic';
        if (!userId) break;

        const status       = mapStatus(sub.status);
        const trialEnd     = sub.trial_end   ? new Date(sub.trial_end * 1000).toISOString()   : null;
        const periodEnd    = sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null;
        const paymentStatus = status === 'active' ? 'active' : status === 'past_due' ? 'past_due' : 'pending';

        await supabase.from('restaurant_plans').upsert({
          user_id:            userId,
          plan_name:          planSlug,
          status,
          payment_status:     paymentStatus,
          stripe_subscription_id: sub.id,
          trial_ends_at:      trialEnd,
          next_billing_at:    periodEnd,
          last_payment_at:    status === 'active' ? new Date().toISOString() : null,
          // Limpa overdue_since se voltou a ser ativo
          ...(status === 'active' ? { overdue_since: null } : {}),
        }, { onConflict: 'user_id' });

        // Desbloqueia cardápio se voltou ao normal
        if (status === 'active') {
          await supabase.from('restaurant_settings')
            .update({ blocked: false, blocked_reason: null })
            .eq('user_id', userId);
        }

        // Notificação para o admin se passou a ser past_due
        if (status === 'past_due') {
          const { data: rs } = await supabase.from('restaurant_settings').select('restaurant_name').eq('user_id', userId).maybeSingle();
          await supabase.from('admin_notifications').insert({
            type: 'payment_failed',
            title: `Pagamento atrasado: ${rs?.restaurant_name ?? userId}`,
            body: `A assinatura do plano ${planSlug} entrou em atraso (Stripe: ${sub.id}).`,
            user_id: userId,
          }).catch(() => {});
        }
        break;
      }

      // ── Assinatura cancelada ─────────────────────────────────────────
      case 'customer.subscription.deleted': {
        const sub    = event.data.object as Stripe.Subscription;
        const userId = sub.metadata?.user_id;
        if (!userId) break;

        await supabase.from('restaurant_plans').update({
          status:         'cancelled',
          payment_status: 'cancelled',
        }).eq('user_id', userId);

        // Bloqueia cardápio
        await supabase.from('restaurant_settings')
          .update({ blocked: true, blocked_reason: 'Assinatura cancelada' })
          .eq('user_id', userId);

        const { data: rs } = await supabase.from('restaurant_settings').select('restaurant_name').eq('user_id', userId).maybeSingle();
        await supabase.from('admin_notifications').insert({
          type: 'restaurant_blocked',
          title: `Assinatura cancelada: ${rs?.restaurant_name ?? userId}`,
          body: `O cliente cancelou ou não pagou — cardápio bloqueado automaticamente.`,
          user_id: userId,
        }).catch(() => {});
        break;
      }

      // ── Pagamento confirmado ─────────────────────────────────────────
      case 'invoice.payment_succeeded': {
        const inv    = event.data.object as Stripe.Invoice;
        const userId = (inv as any).subscription_details?.metadata?.user_id ?? inv.metadata?.user_id;
        if (!userId) break;

        const periodEnd = inv.lines?.data?.[0]?.period?.end
          ? new Date(inv.lines.data[0].period.end * 1000).toISOString()
          : null;

        await supabase.from('restaurant_plans').update({
          status:         'active',
          payment_status: 'active',
          last_payment_at: new Date().toISOString(),
          next_billing_at: periodEnd,
          overdue_since:  null,
        }).eq('user_id', userId);

        await supabase.from('restaurant_settings')
          .update({ blocked: false, blocked_reason: null })
          .eq('user_id', userId);

        // Registra no histórico (evita duplicata pela reference do invoice)
        const { data: existingInv } = await supabase
          .from('payment_history')
          .select('id')
          .eq('reference', inv.id)
          .maybeSingle();

        if (!existingInv) {
          const planSlug = (inv as any).subscription_details?.metadata?.plan_slug ?? 'pro';
          await supabase.from('payment_history').insert({
            user_id:    userId,
            amount:     (inv.amount_paid ?? 0) / 100,
            method:     'stripe',
            status:     'paid',
            reference:  inv.id,
            notes:      `Cobrança automática via Stripe — Plano ${planSlug}`,
            paid_at:    new Date().toISOString(),
            created_by: null,
          });
        }
        break;
      }

      // ── Pagamento falhou ─────────────────────────────────────────────
      case 'invoice.payment_failed': {
        const inv    = event.data.object as Stripe.Invoice;
        const userId = (inv as any).subscription_details?.metadata?.user_id ?? inv.metadata?.user_id;
        if (!userId) break;

        await supabase.from('restaurant_plans').update({
          payment_status: 'past_due',
          status:         'past_due',
        }).eq('user_id', userId);

        const { data: rs } = await supabase.from('restaurant_settings').select('restaurant_name').eq('user_id', userId).maybeSingle();
        await supabase.from('admin_notifications').insert({
          type: 'payment_failed',
          title: `Pagamento recusado: ${rs?.restaurant_name ?? userId}`,
          body: `Tentativa de cobrança falhou (invoice: ${inv.id}). Valor: R$ ${((inv.amount_due ?? 0) / 100).toFixed(2)}.`,
          user_id: userId,
        }).catch(() => {});
        break;
      }
    }
  } catch (err: any) {
    console.error('Erro ao processar evento', event.type, err);
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
