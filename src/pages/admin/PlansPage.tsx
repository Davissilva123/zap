import { useEffect, useState } from 'react';
import { db } from '../../lib/db';
import { Check, X, Zap, Star, Crown, Plus, Trash2, Tag, CreditCard, RefreshCw } from 'lucide-react';

const PLANS = [
  {
    slug: 'basic', name: 'Básico', price: 39, period: 'mês', trial: '7 dias grátis',
    icon: Zap, color: 'border-slate-300', iconColor: 'bg-slate-100 text-slate-600', badge: null,
    description: 'Para quem está começando a digitalizar o atendimento',
    features: [
      { label: 'Cardápio online com QR Code', ok: true },
      { label: 'Até 50 itens no cardápio', ok: true },
      { label: 'Portal do cliente com histórico', ok: true },
      { label: '2 operadores', ok: true },
      { label: 'Suporte por email', ok: true },
      { label: 'PIX automático (Mercado Pago)', ok: false },
      { label: 'WhatsApp automático', ok: false },
      { label: 'Relatórios e análises', ok: false },
      { label: 'KDS para cozinha', ok: false },
      { label: 'Entregadores com GPS', ok: false },
    ],
  },
  {
    slug: 'pro', name: 'Pro', price: 89, period: 'mês', trial: '7 dias grátis',
    icon: Star, color: 'border-blue-400 ring-2 ring-blue-400/20', iconColor: 'bg-blue-100 text-blue-600',
    badge: 'Mais popular', badgeColor: 'bg-blue-600',
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
    ],
  },
  {
    slug: 'premium', name: 'Premium', price: 149, period: 'mês', trial: '7 dias grátis',
    icon: Crown, color: 'border-violet-500 ring-2 ring-violet-500/20', iconColor: 'bg-violet-100 text-violet-600',
    badge: 'Completo', badgeColor: 'bg-violet-600',
    description: 'Solução completa para restaurantes e redes',
    features: [
      { label: 'Tudo do Pro', ok: true },
      { label: 'Operadores ilimitados', ok: true },
      { label: 'KDS para cozinha', ok: true },
      { label: 'Sistema de entregadores + GPS', ok: true },
      { label: 'Comandas digitais', ok: true },
      { label: 'Avaliações dos clientes', ok: true },
      { label: 'Suporte via WhatsApp', ok: true },
      { label: 'Relatórios avançados + exportação', ok: true },
      { label: 'API de acesso (em breve)', ok: true },
      { label: 'Onboarding dedicado', ok: true },
    ],
  },
];

type Coupon = Awaited<ReturnType<typeof db.getSubscriptionCoupons>>[number];

export default function AdminPlansPage() {
  const [editing, setEditing] = useState<string | null>(null);
  const [prices, setPrices] = useState<Record<string, number>>({ basic: 39, pro: 89, premium: 149 });
  const [saved, setSaved] = useState<string | null>(null);
  const [tab, setTab] = useState<'plans' | 'coupons' | 'stripe'>('plans');

  // Coupons state
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loadingCoupons, setLoadingCoupons] = useState(false);
  const [showNewCoupon, setShowNewCoupon] = useState(false);
  const [newCoupon, setNewCoupon] = useState({ code: '', discountType: 'percent', discountValue: '', maxUses: '', expiresAt: '' });
  const [savingCoupon, setSavingCoupon] = useState(false);

  const loadCoupons = async () => {
    setLoadingCoupons(true);
    try { setCoupons(await db.getSubscriptionCoupons().catch(() => [])); }
    finally { setLoadingCoupons(false); }
  };

  useEffect(() => { if (tab === 'coupons') loadCoupons(); }, [tab]);

  const savePrice = (slug: string, price: number) => {
    setPrices(p => ({ ...p, [slug]: price }));
    setEditing(null);
    setSaved(slug);
    setTimeout(() => setSaved(null), 2000);
  };

  const handleCreateCoupon = async () => {
    if (!newCoupon.code || !newCoupon.discountValue) return;
    setSavingCoupon(true);
    try {
      await db.createSubscriptionCoupon(
        newCoupon.code,
        newCoupon.discountType,
        Number(newCoupon.discountValue),
        newCoupon.maxUses ? Number(newCoupon.maxUses) : null,
        newCoupon.expiresAt || null,
      );
      setNewCoupon({ code: '', discountType: 'percent', discountValue: '', maxUses: '', expiresAt: '' });
      setShowNewCoupon(false);
      await loadCoupons();
    } catch (e: any) {
      alert(e?.message ?? 'Erro ao criar cupom');
    } finally {
      setSavingCoupon(false);
    }
  };

  const handleToggleCoupon = async (id: string) => {
    await db.toggleSubscriptionCoupon(id);
    setCoupons(prev => prev.map(c => c.id === id ? { ...c, active: !c.active } : c));
  };

  const handleDeleteCoupon = async (id: string) => {
    if (!confirm('Deletar este cupom?')) return;
    await db.deleteSubscriptionCoupon(id);
    setCoupons(prev => prev.filter(c => c.id !== id));
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">Planos & Cobrança</h1>
        <p className="text-slate-500 text-sm mt-0.5">Estrutura de planos, cupons de assinatura e integração Stripe</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {([['plans', 'Planos'], ['coupons', 'Cupons'], ['stripe', 'Stripe']] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${tab === key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* ---- PLANS ---- */}
      {tab === 'plans' && (
        <div className="space-y-5">
          <div className="card p-4 bg-emerald-50 border border-emerald-200 flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
              <Zap className="w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-emerald-800">Trial de 7 dias grátis em todos os planos</p>
              <p className="text-xs text-emerald-700 mt-0.5">Após o trial, o cliente precisa confirmar o pagamento para continuar.</p>
            </div>
          </div>

          <div className="grid lg:grid-cols-3 gap-5">
            {PLANS.map(plan => {
              const Icon = plan.icon;
              const isEditing = editing === plan.slug;
              const isSaved = saved === plan.slug;
              return (
                <div key={plan.slug} className={`relative bg-white rounded-3xl border-2 p-6 ${plan.color}`}>
                  {plan.badge && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                      <span className={`text-white text-xs font-bold px-4 py-1.5 rounded-full shadow-lg ${(plan as any).badgeColor}`}>{plan.badge}</span>
                    </div>
                  )}
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${plan.iconColor}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="text-lg font-black text-slate-900 mb-1">{plan.name}</h3>
                  <p className="text-xs text-slate-400 mb-4 leading-relaxed">{plan.description}</p>
                  <div className="mb-1">
                    {isEditing ? (
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500 text-sm font-semibold">R$</span>
                        <input
                          type="number" defaultValue={prices[plan.slug]}
                          onBlur={e => savePrice(plan.slug, Number(e.target.value))}
                          onKeyDown={e => e.key === 'Enter' && savePrice(plan.slug, Number((e.target as HTMLInputElement).value))}
                          autoFocus className="input w-24 text-2xl font-black py-1"
                        />
                        <span className="text-slate-400 text-sm">/mês</span>
                        <button onClick={() => setEditing(null)}><X className="w-4 h-4 text-slate-400" /></button>
                      </div>
                    ) : (
                      <button onClick={() => setEditing(plan.slug)} className="flex items-baseline gap-1 group hover:opacity-80 transition-opacity" title="Clique para editar">
                        <span className="text-3xl font-black text-slate-900">R$ {prices[plan.slug]}</span>
                        <span className="text-slate-400 text-sm">/{plan.period}</span>
                        <span className="text-xs text-slate-300 group-hover:text-slate-400 ml-1">(editar)</span>
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-emerald-600 font-semibold mb-5">{plan.trial}</p>
                  <ul className="space-y-2.5">
                    {plan.features.map((f, i) => (
                      <li key={i} className={`flex items-start gap-2 text-xs ${f.ok ? 'text-slate-600' : 'text-slate-300'}`}>
                        {f.ok ? <Check className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-0.5" /> : <X className="w-3.5 h-3.5 text-slate-200 flex-shrink-0 mt-0.5" />}
                        {f.label}
                      </li>
                    ))}
                  </ul>
                  {isSaved && <div className="mt-4 flex items-center gap-1.5 text-xs text-emerald-600 font-semibold"><Check className="w-3.5 h-3.5" /> Salvo</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ---- COUPONS ---- */}
      {tab === 'coupons' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">Cupons de assinatura</h2>
              <p className="text-xs text-slate-400 mt-0.5">Descontos no plano mensal (% ou valor fixo)</p>
            </div>
            <div className="flex gap-2">
              <button onClick={loadCoupons} className="btn-secondary" disabled={loadingCoupons}>
                <RefreshCw className={`w-4 h-4 ${loadingCoupons ? 'animate-spin' : ''}`} />
              </button>
              <button onClick={() => setShowNewCoupon(true)} className="btn-primary">
                <Plus className="w-4 h-4" /> Novo cupom
              </button>
            </div>
          </div>

          {/* New coupon form */}
          {showNewCoupon && (
            <div className="card p-5 border-2 border-violet-200 bg-violet-50/30 space-y-4">
              <p className="text-sm font-bold text-slate-900">Novo cupom de assinatura</p>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="label">Código</label>
                  <input value={newCoupon.code} onChange={e => setNewCoupon(p => ({ ...p, code: e.target.value.toUpperCase() }))}
                    className="input font-mono" placeholder="PRIMEIRO30" />
                </div>
                <div>
                  <label className="label">Tipo de desconto</label>
                  <select value={newCoupon.discountType} onChange={e => setNewCoupon(p => ({ ...p, discountType: e.target.value }))} className="input">
                    <option value="percent">Porcentagem (%)</option>
                    <option value="fixed">Valor fixo (R$)</option>
                  </select>
                </div>
                <div>
                  <label className="label">{newCoupon.discountType === 'percent' ? 'Desconto (%)' : 'Valor (R$)'}</label>
                  <input type="number" value={newCoupon.discountValue} onChange={e => setNewCoupon(p => ({ ...p, discountValue: e.target.value }))}
                    className="input" placeholder={newCoupon.discountType === 'percent' ? '30' : '20'} />
                </div>
                <div>
                  <label className="label">Máximo de usos (deixe vazio para ilimitado)</label>
                  <input type="number" value={newCoupon.maxUses} onChange={e => setNewCoupon(p => ({ ...p, maxUses: e.target.value }))}
                    className="input" placeholder="100" />
                </div>
                <div>
                  <label className="label">Expira em (opcional)</label>
                  <input type="date" value={newCoupon.expiresAt} onChange={e => setNewCoupon(p => ({ ...p, expiresAt: e.target.value }))} className="input" />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setShowNewCoupon(false)} className="btn-secondary">Cancelar</button>
                <button onClick={handleCreateCoupon} disabled={savingCoupon || !newCoupon.code || !newCoupon.discountValue} className="btn-primary">
                  {savingCoupon ? 'Criando...' : 'Criar cupom'}
                </button>
              </div>
            </div>
          )}

          {/* Coupons list */}
          <div className="card overflow-hidden">
            {loadingCoupons ? (
              <div className="p-10 flex items-center justify-center">
                <div className="w-7 h-7 border-4 border-slate-200 border-t-violet-500 rounded-full animate-spin" />
              </div>
            ) : coupons.length === 0 ? (
              <div className="p-8 text-center">
                <Tag className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                <p className="text-slate-400 text-sm">Nenhum cupom cadastrado</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {coupons.map(c => (
                  <div key={c.id} className="px-5 py-3.5 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-bold text-slate-900">{c.code}</span>
                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${c.active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
                          {c.active ? 'Ativo' : 'Inativo'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {c.discountType === 'percent' ? `${c.discountValue}% de desconto` : `R$ ${c.discountValue} de desconto`}
                        {' · '}{c.usesCount}{c.maxUses ? `/${c.maxUses}` : ''} usos
                        {c.expiresAt && ` · expira ${new Date(c.expiresAt).toLocaleDateString('pt-BR')}`}
                      </p>
                    </div>
                    <button onClick={() => handleToggleCoupon(c.id)}
                      className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${c.active ? 'bg-emerald-400' : 'bg-slate-200'}`}>
                      <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${c.active ? 'left-5' : 'left-0.5'}`} />
                    </button>
                    <button onClick={() => handleDeleteCoupon(c.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-300 hover:text-red-400 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---- STRIPE ---- */}
      {tab === 'stripe' && (
        <div className="space-y-4">
          <div className="card p-5 border-2 border-slate-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">Cobrança recorrente via Stripe</h2>
                <p className="text-xs text-slate-400">Configuração para cobrar assinaturas automaticamente</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
                <p className="font-bold mb-1">Configuração necessária (1 vez)</p>
                <p className="text-xs text-amber-700">O Stripe requer um servidor para criar sessões de checkout com segurança. Siga os passos abaixo.</p>
              </div>

              <ol className="space-y-3 text-sm">
                {[
                  { n: '1', title: 'Crie uma conta no Stripe', desc: 'Acesse stripe.com e ative sua conta com os dados do negócio.' },
                  { n: '2', title: 'Crie os produtos no Stripe', desc: 'Crie 3 produtos recorrentes: Básico (R$39/mês), Pro (R$89/mês), Premium (R$149/mês). Copie os Price IDs.' },
                  { n: '3', title: 'Deploy da Edge Function', desc: 'Execute no terminal: supabase functions deploy create-checkout. O arquivo está em supabase/functions/create-checkout/index.ts.' },
                  { n: '4', title: 'Configure as env vars', desc: 'Adicione STRIPE_SECRET_KEY e STRIPE_WEBHOOK_SECRET nas variáveis de ambiente da Supabase Edge Function.' },
                  { n: '5', title: 'Configure o Webhook', desc: 'No Stripe Dashboard → Webhooks, aponte para: https://[seu-projeto].supabase.co/functions/v1/stripe-webhook. Eventos: customer.subscription.*' },
                  { n: '6', title: 'Adicione a chave pública', desc: 'Adicione VITE_STRIPE_PUBLISHABLE_KEY=pk_live_... no Vercel (Environment Variables).' },
                ].map(step => (
                  <li key={step.n} className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-violet-100 text-violet-700 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{step.n}</span>
                    <div>
                      <p className="font-semibold text-slate-800">{step.title}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{step.desc}</p>
                    </div>
                  </li>
                ))}
              </ol>

              <div className="p-4 bg-slate-50 rounded-xl">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">Status atual</p>
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ? 'bg-emerald-400' : 'bg-slate-300'}`} />
                    <span className="text-slate-600">Chave pública Stripe</span>
                    <span className={`font-medium ${import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ? 'text-emerald-600' : 'text-slate-400'}`}>
                      {import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ? 'Configurada' : 'Não configurada'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-slate-300" />
                    <span className="text-slate-600">Edge Function</span>
                    <span className="text-slate-400 font-medium">Verificar manualmente</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="card p-4 bg-violet-50 border border-violet-200">
            <p className="text-sm font-bold text-violet-900 mb-1">Dunning automático</p>
            <p className="text-xs text-violet-700">
              Quando o Stripe não consegue cobrar (cartão expirado, limite, etc.), ele tenta novamente por 4 dias.
              Após 4 tentativas, o status muda para <code className="bg-violet-100 px-1 rounded">past_due</code>.
              O ZapMenu exibe um banner de aviso ao dono do restaurante e bloqueia o cardápio após 7 dias de atraso.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
