import { useState } from 'react';
import { Check, X, Zap, Star, Crown } from 'lucide-react';

const PLANS = [
  {
    slug: 'basic',
    name: 'Básico',
    price: 39,
    period: 'mês',
    trial: '7 dias grátis',
    icon: Zap,
    color: 'border-slate-300',
    iconColor: 'bg-slate-100 text-slate-600',
    badge: null,
    description: 'Para quem está começando a digitalizar o atendimento',
    features: [
      { label: 'Cardápio online com QR Code', ok: true },
      { label: 'Até 50 itens no cardápio', ok: true },
      { label: 'Portal do cliente com histórico', ok: true },
      { label: 'Pedidos via WhatsApp (manual)', ok: true },
      { label: '2 operadores', ok: true },
      { label: 'Suporte por email', ok: true },
      { label: 'PIX automático (Mercado Pago)', ok: false },
      { label: 'WhatsApp automático', ok: false },
      { label: 'Relatórios e análises', ok: false },
      { label: 'Cupons e promoções', ok: false },
      { label: 'KDS para cozinha', ok: false },
      { label: 'Entregadores com GPS', ok: false },
    ],
  },
  {
    slug: 'pro',
    name: 'Pro',
    price: 89,
    period: 'mês',
    trial: '7 dias grátis',
    icon: Star,
    color: 'border-blue-400 ring-2 ring-blue-400/20',
    iconColor: 'bg-blue-100 text-blue-600',
    badge: 'Mais popular',
    badgeColor: 'bg-blue-600',
    description: 'Para restaurantes que querem crescer com tecnologia',
    features: [
      { label: 'Tudo do Básico', ok: true },
      { label: 'Itens ilimitados', ok: true },
      { label: 'PIX automático (Mercado Pago)', ok: true },
      { label: 'WhatsApp automático', ok: true },
      { label: 'Relatórios e análises', ok: true },
      { label: 'Cupons e promoções', ok: true },
      { label: 'Até 5 operadores', ok: true },
      { label: 'Suporte prioritário', ok: true },
      { label: 'KDS para cozinha', ok: false },
      { label: 'Entregadores com GPS', ok: false },
      { label: 'Comandas digitais', ok: false },
      { label: 'Suporte via WhatsApp', ok: false },
    ],
  },
  {
    slug: 'premium',
    name: 'Premium',
    price: 149,
    period: 'mês',
    trial: '7 dias grátis',
    icon: Crown,
    color: 'border-violet-500 ring-2 ring-violet-500/20',
    iconColor: 'bg-violet-100 text-violet-600',
    badge: 'Completo',
    badgeColor: 'bg-violet-600',
    description: 'Solução completa para restaurantes e redes',
    features: [
      { label: 'Tudo do Pro', ok: true },
      { label: 'Operadores ilimitados', ok: true },
      { label: 'KDS para cozinha', ok: true },
      { label: 'Sistema de entregadores + GPS', ok: true },
      { label: 'Comandas digitais', ok: true },
      { label: 'Avaliações dos clientes', ok: true },
      { label: 'Múltiplos locais / cardápios', ok: true },
      { label: 'Suporte via WhatsApp', ok: true },
      { label: 'Integração com sistemas externos', ok: true },
      { label: 'Relatórios avançados + exportação', ok: true },
      { label: 'API de acesso (em breve)', ok: true },
      { label: 'Onboarding dedicado', ok: true },
    ],
  },
];

export default function AdminPlansPage() {
  const [editing, setEditing] = useState<string | null>(null);
  const [prices, setPrices] = useState<Record<string, number>>({
    basic: 39,
    pro: 89,
    premium: 149,
  });
  const [saved, setSaved] = useState<string | null>(null);

  const savePrice = async (slug: string, price: number) => {
    // TODO: persist to DB via RPC update_plan_price(slug, price)
    setPrices(p => ({ ...p, [slug]: price }));
    setEditing(null);
    setSaved(slug);
    setTimeout(() => setSaved(null), 2000);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">Planos</h1>
        <p className="text-slate-500 text-sm mt-0.5">
          Estrutura de planos da plataforma · todos com <strong>7 dias de trial grátis</strong>
        </p>
      </div>

      {/* Trial banner */}
      <div className="card p-4 bg-emerald-50 border border-emerald-200 flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
          <Zap className="w-4 h-4 text-emerald-600" />
        </div>
        <div>
          <p className="text-sm font-bold text-emerald-800">Trial de 7 dias grátis em todos os planos</p>
          <p className="text-xs text-emerald-700 mt-0.5">
            Novos usuários têm acesso completo ao plano escolhido por 7 dias. Após o trial, precisam confirmar o pagamento para continuar.
          </p>
        </div>
      </div>

      {/* Plans grid */}
      <div className="grid lg:grid-cols-3 gap-5">
        {PLANS.map(plan => {
          const Icon = plan.icon;
          const isEditing = editing === plan.slug;
          const isSaved = saved === plan.slug;

          return (
            <div key={plan.slug} className={`relative bg-white rounded-3xl border-2 p-6 ${plan.color}`}>
              {plan.badge && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                  <span className={`text-white text-xs font-bold px-4 py-1.5 rounded-full shadow-lg ${plan.badgeColor}`}>
                    {plan.badge}
                  </span>
                </div>
              )}

              <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${plan.iconColor}`}>
                <Icon className="w-5 h-5" />
              </div>

              <h3 className="text-lg font-black text-slate-900 mb-1">{plan.name}</h3>
              <p className="text-xs text-slate-400 mb-4 leading-relaxed">{plan.description}</p>

              {/* Price (editable) */}
              <div className="mb-1">
                {isEditing ? (
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500 text-sm font-semibold">R$</span>
                    <input
                      type="number"
                      defaultValue={prices[plan.slug]}
                      onBlur={e => savePrice(plan.slug, Number(e.target.value))}
                      onKeyDown={e => e.key === 'Enter' && savePrice(plan.slug, Number((e.target as HTMLInputElement).value))}
                      autoFocus
                      className="input w-24 text-2xl font-black py-1"
                    />
                    <span className="text-slate-400 text-sm">/mês</span>
                    <button onClick={() => setEditing(null)} className="p-1 text-slate-400 hover:text-slate-600">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setEditing(plan.slug)}
                    className="flex items-baseline gap-1 group hover:opacity-80 transition-opacity"
                    title="Clique para editar o preço"
                  >
                    <span className="text-3xl font-black text-slate-900">R$ {prices[plan.slug]}</span>
                    <span className="text-slate-400 text-sm">/{plan.period}</span>
                    <span className="text-xs text-slate-300 group-hover:text-slate-400 ml-1 transition-colors">(editar)</span>
                  </button>
                )}
              </div>

              <p className="text-xs text-emerald-600 font-semibold mb-5">{plan.trial}</p>

              {/* Features */}
              <ul className="space-y-2.5">
                {plan.features.map((f, i) => (
                  <li key={i} className={`flex items-start gap-2 text-xs ${f.ok ? 'text-slate-600' : 'text-slate-300'}`}>
                    {f.ok
                      ? <Check className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-0.5" />
                      : <X className="w-3.5 h-3.5 text-slate-200 flex-shrink-0 mt-0.5" />
                    }
                    {f.label}
                  </li>
                ))}
              </ul>

              {isSaved && (
                <div className="mt-4 flex items-center gap-1.5 text-xs text-emerald-600 font-semibold">
                  <Check className="w-3.5 h-3.5" /> Preço atualizado
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="card p-4 text-sm text-slate-500 bg-slate-50">
        <strong className="text-slate-700">Nota:</strong> Para alterar o plano de um cliente específico, acesse a aba <strong>Restaurantes</strong> e use o seletor de plano ao lado de cada restaurante.
      </div>
    </div>
  );
}
